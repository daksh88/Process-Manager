from flask import Flask, jsonify, request
from flask_cors import CORS  # Add this import
import psutil

app = Flask(__name__)
CORS(app)  # Add this line

@app.route("/api/processes", methods=["GET"])
def get_processes():
    process_list = []
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                process_list.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                print(f"Error accessing process: {e}")
                continue
        print(f"Found {len(process_list)} processes")
        return jsonify(process_list)
    except Exception as e:
        print(f"Error in get_processes: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/terminate", methods=["POST"])
def terminate_process():
    data = request.get_json()
    pid = data.get("pid")
    try:
        p = psutil.Process(pid)
        p.terminate()
        return jsonify({"status": "success", "message": f"Process {pid} terminated."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route("/api/usage", methods=["GET"])
def get_usage():
    return jsonify({
        "cpu": psutil.cpu_percent(interval=1),
        "memory": psutil.virtual_memory().percent
    })

if __name__ == "__main__":
    app.run(debug=True)
