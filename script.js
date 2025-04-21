let currentTab = 'apps';
let cpuChart, memoryChart;
const maxDataPoints = 60; // Show last 60 seconds of data
const cpuData = [];
const memoryData = [];
const BASE_URL = "https://flask-monitor-app.onrender.com";  // your backend URL

const res = await fetch(`${BASE_URL}/api/processes`);
function switchTab(tab) {
    currentTab = tab;
    const buttons = document.querySelectorAll('.tab-button');
    const tabs = document.querySelectorAll('.tab-content');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    tabs.forEach(tab => tab.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
    
    if (tab === 'monitor' && !cpuChart) {
        initializeCharts();
    }
    
    if (tab === 'apps' || tab === 'system') {
        loadProcesses();
    }
}

function initializeCharts() {
    const cpuCtx = document.getElementById('cpuChart').getContext('2d');
    const memoryCtx = document.getElementById('memoryChart').getContext('2d');

    cpuChart = new Chart(cpuCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'CPU Usage %',
                data: [],
                borderColor: '#3498db',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(52, 152, 219, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            animation: {
                duration: 0
            }
        }
    });

    memoryChart = new Chart(memoryCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Memory Usage %',
                data: [],
                borderColor: '#e74c3c',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(231, 76, 60, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            animation: {
                duration: 0
            }
        }
    });
}

async function updateCharts() {
    try {
        const res = await fetch("http://127.0.0.1:5000/api/usage");
        const data = await res.json();
        
        const now = new Date().toLocaleTimeString();
        
        // Update percentage displays
        document.getElementById('monitor-cpu').textContent = `${data.cpu.toFixed(1)}%`;
        document.getElementById('monitor-memory').textContent = `${data.memory.toFixed(1)}%`;
        
        cpuData.push(data.cpu);
        memoryData.push(data.memory);
        
        if (cpuData.length > maxDataPoints) {
            cpuData.shift();
            memoryData.shift();
        }
        
        const labels = Array(cpuData.length).fill('').map((_, i) => 
            i === 0 || i === cpuData.length - 1 ? 
            now : ''
        );

        if (cpuChart && memoryChart) {
            cpuChart.data.labels = labels;
            cpuChart.data.datasets[0].data = cpuData;
            cpuChart.update();

            memoryChart.data.labels = labels;
            memoryChart.data.datasets[0].data = memoryData;
            memoryChart.update();
        }
    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

async function loadProcesses() {
    try {
        const res = await fetch("http://127.0.0.1:5000/api/processes");
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        
        const searchVal = document.getElementById(currentTab === 'apps' ? "search" : "system-search")?.value.toLowerCase() || '';
        const tbody = document.getElementById(currentTab === 'apps' ? "processTable" : "systemTable");
        tbody.innerHTML = "";

        // Create Maps to store processes
        const appProcesses = new Map();
        const systemProcesses = new Map();

        data.forEach(proc => {
            const name = proc.name.toLowerCase();
            
            // Define system process patterns
            const isSystemProcess = 
                name.includes('svchost') ||
                name.includes('system') ||
                name.startsWith('sys') ||
                name.includes('service') ||
                name.includes('runtime') ||
                name.includes('dllhost') ||
                name.includes('csrss') ||
                name.includes('smss') ||
                name.includes('wininit') ||
                name.startsWith('win') ||
                name.includes('host') ||
                !name.endsWith('.exe');

            if (!searchVal || name.includes(searchVal)) {
                if (isSystemProcess && currentTab === 'system') {
                    // Group system processes
                    if (systemProcesses.has(proc.name)) {
                        const existing = systemProcesses.get(proc.name);
                        existing.cpu_percent += proc.cpu_percent;
                        existing.memory_percent += proc.memory_percent;
                        existing.instances = (existing.instances || 1) + 1;
                    } else {
                        proc.instances = 1;
                        systemProcesses.set(proc.name, proc);
                    }
                } else if (!isSystemProcess && currentTab === 'apps') {
                    // Store unique applications
                    if (!appProcesses.has(proc.name) || 
                        appProcesses.get(proc.name).cpu_percent < proc.cpu_percent) {
                        appProcesses.set(proc.name, proc);
                    }
                }
            }
        });

        // Get the appropriate process list based on current tab
        const processesToShow = Array.from(
            (currentTab === 'apps' ? appProcesses : systemProcesses).values()
        ).sort((a, b) => b.cpu_percent - a.cpu_percent);

        if (processesToShow.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5">No ${currentTab === 'apps' ? 'applications' : 'system processes'} found</td></tr>`;
            return;
        }

        processesToShow.forEach(proc => {
            const row = `<tr>
                <td>${proc.pid}</td>
                <td>${proc.name}${proc.instances ? ` (${proc.instances} instances)` : ''}</td>
                <td>${proc.cpu_percent.toFixed(1)}%</td>
                <td>${proc.memory_percent.toFixed(1)}%</td>
                <td><button onclick="terminate(${proc.pid})" class="terminate-btn">Terminate</button></td>
            </tr>`;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error('Error loading processes:', error);
        const tbody = document.getElementById(currentTab === 'apps' ? "processTable" : "systemTable");
        tbody.innerHTML = '<tr><td colspan="5">Error loading processes. Make sure the backend server is running.</td></tr>';
    }
}

async function terminate(pid) {
    const res = await fetch("http://127.0.0.1:5000/api/terminate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid })
    });
    const result = await res.json();
    alert(result.message);
    loadProcesses();
}

async function showUsage() {
    const res = await fetch("http://127.0.0.1:5000/api/usage");
    const data = await res.json();
    document.getElementById("usage").innerText =
        `CPU Usage: ${data.cpu}% | Memory Usage: ${data.memory}%`;
}
setInterval(showUsage, 2000);

// Update interval for charts (every second)
setInterval(() => {
    if (currentTab === 'monitor') {
        updateCharts();
    }
}, 1000);

loadProcesses();
