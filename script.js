let currentTab = 'apps';

function switchTab(tab) {
    currentTab = tab;
    const buttons = document.querySelectorAll('.tab-button');
    const tabs = document.querySelectorAll('.tab-content');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    tabs.forEach(tabContent => tabContent.classList.remove('active'));
    

    const tabIndex = ['apps', 'system', 'monitor'].indexOf(tab);
    if (tabIndex !== -1) buttons[tabIndex].classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
    
    if (tab === 'apps' || tab === 'system') {
        loadProcesses();
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

        const appProcesses = new Map();
        const systemProcesses = new Map();

        data.forEach(proc => {
            const name = proc.name.toLowerCase();
            
             
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
                     
                    if (!appProcesses.has(proc.name) || 
                        appProcesses.get(proc.name).cpu_percent < proc.cpu_percent) {
                        appProcesses.set(proc.name, proc);
                    }
                }
            }
        });

         
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

 
let cpuChart, memoryChart;
let cpuData = [];
let memoryData = [];
let chartLabels = [];

function setupCharts() {
    const cpuCtx = document.getElementById('cpuChart').getContext('2d');
    const memoryCtx = document.getElementById('memoryChart').getContext('2d');

    cpuChart = new Chart(cpuCtx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'CPU Usage (%)',
                data: cpuData,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52,152,219,0.1)',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { min: 0, max: 100 }
            }
        }
    });

    memoryChart = new Chart(memoryCtx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Memory Usage (%)',
                data: memoryData,
                borderColor: '#e67e22',
                backgroundColor: 'rgba(230,126,34,0.1)',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { min: 0, max: 100 }
            }
        }
    });
}

async function showUsage() {
    const res = await fetch("http://127.0.0.1:5000/api/usage");
    const data = await res.json();
    document.getElementById("usage").innerText =
        `CPU Usage: ${data.cpu}% | Memory Usage: ${data.memory}%`;

     
    const now = new Date();
    const label = now.getHours().toString().padStart(2, '0') + ':' +
                  now.getMinutes().toString().padStart(2, '0') + ':' +
                  now.getSeconds().toString().padStart(2, '0');
    chartLabels.push(label);
    cpuData.push(data.cpu);
    memoryData.push(data.memory);

     
    if (chartLabels.length > 30) {
        chartLabels.shift();
        cpuData.shift();
        memoryData.shift();
    }

    if (cpuChart && memoryChart) {
        cpuChart.update();
        memoryChart.update();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setupCharts();
    loadProcesses();
    setInterval(showUsage, 2000);
});
