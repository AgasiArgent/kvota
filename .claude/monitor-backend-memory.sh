#!/bin/bash
# Monitor backend memory usage over time
# Usage: ./monitor-backend-memory.sh [duration_minutes] [interval_seconds]

DURATION_MIN=${1:-30}  # Default: 30 minutes
INTERVAL_SEC=${2:-10}  # Default: 10 seconds

ITERATIONS=$((DURATION_MIN * 60 / INTERVAL_SEC))
OUTPUT_FILE="/tmp/backend_memory_log_$(date +%Y%m%d_%H%M%S).csv"

echo "timestamp,memory_mb,cpu_percent,rss_mb,vms_mb" > "$OUTPUT_FILE"
echo "Monitoring backend memory for $DURATION_MIN minutes (interval: ${INTERVAL_SEC}s)"
echo "Output: $OUTPUT_FILE"

for i in $(seq 1 $ITERATIONS); do
    timestamp=$(date +%s)

    # Find uvicorn process
    pid=$(pgrep -f "uvicorn main:app" | head -1)

    if [ -z "$pid" ]; then
        echo "$timestamp,0,0,0,0" >> "$OUTPUT_FILE"
        echo "⚠️  Backend not running (iteration $i/$ITERATIONS)"
    else
        # Get memory and CPU using ps
        stats=$(ps -p $pid -o %mem,%cpu,rss,vsz --no-headers)
        mem_percent=$(echo "$stats" | awk '{print $1}')
        cpu_percent=$(echo "$stats" | awk '{print $2}')
        rss_kb=$(echo "$stats" | awk '{print $3}')
        vsz_kb=$(echo "$stats" | awk '{print $4}')

        # Convert to MB
        rss_mb=$(echo "scale=2; $rss_kb / 1024" | bc)
        vsz_mb=$(echo "scale=2; $vsz_kb / 1024" | bc)

        echo "$timestamp,$rss_mb,$cpu_percent,$rss_mb,$vsz_mb" >> "$OUTPUT_FILE"

        # Progress indicator
        echo "[$i/$ITERATIONS] Memory: ${rss_mb}MB, CPU: ${cpu_percent}%"
    fi

    sleep $INTERVAL_SEC
done

echo ""
echo "✅ Monitoring complete!"
echo "Results saved to: $OUTPUT_FILE"

# Generate summary
echo ""
echo "Summary:"
awk -F',' 'NR>1 {sum+=$2; if($2>max) max=$2; if(min=="" || $2<min) min=$2; count++} END {print "  Min Memory: " min " MB\n  Max Memory: " max " MB\n  Avg Memory: " sum/count " MB"}' "$OUTPUT_FILE"
