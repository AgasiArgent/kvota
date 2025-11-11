from jinja2 import Template
from typing import List
from datetime import datetime
from validation.calculator_validator import ValidationResult, ValidationMode


class ReportGenerator:
    """Generate validation reports in HTML format"""

    def generate_html_report(
        self,
        results: List[ValidationResult],
        mode: ValidationMode
    ) -> str:
        """Generate HTML report with summary statistics and detailed results"""

        # Calculate statistics
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        failed = total - passed
        pass_rate = (passed / total * 100) if total > 0 else 0
        avg_dev = sum(r.max_deviation for r in results) / total if total > 0 else 0
        max_dev = max((r.max_deviation for r in results), default=0)
        max_dev_file = max(results, key=lambda r: r.max_deviation).excel_file if results else ""

        template = Template("""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Validation Report - {{ mode.value|upper }}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 40px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        .meta {
            color: #7f8c8d;
            margin-bottom: 30px;
        }
        .meta strong {
            color: #34495e;
        }
        .summary {
            background: #ecf0f1;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }
        .stat {
            flex: 1;
            min-width: 150px;
        }
        .stat-label {
            font-size: 14px;
            color: #7f8c8d;
            margin-bottom: 8px;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
        }
        .passed .stat-value {
            color: #27ae60;
        }
        .failed .stat-value {
            color: #e74c3c;
        }
        h2 {
            color: #2c3e50;
            margin-top: 40px;
            margin-bottom: 20px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            background: white;
        }
        th, td {
            border: 1px solid #bdc3c7;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #34495e;
            color: white;
            font-weight: 600;
        }
        .file-passed {
            background: #d5f4e6;
        }
        .file-failed {
            background: #fadbd8;
        }
        .status-passed {
            color: #27ae60;
            font-weight: bold;
        }
        .status-failed {
            color: #e74c3c;
            font-weight: bold;
        }
        .status-error {
            color: #e67e22;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Validation Report</h1>
        <div class="meta">
            <p><strong>Mode:</strong> {{ mode.value|upper }}</p>
            <p><strong>Generated:</strong> {{ timestamp }}</p>
        </div>

        <div class="summary">
            <div class="stat">
                <div class="stat-label">Total Files</div>
                <div class="stat-value">{{ total }}</div>
            </div>
            <div class="stat passed">
                <div class="stat-label">Passed</div>
                <div class="stat-value">{{ passed }}</div>
            </div>
            <div class="stat failed">
                <div class="stat-label">Failed</div>
                <div class="stat-value">{{ failed }}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Pass Rate</div>
                <div class="stat-value">{{ "%.1f"|format(pass_rate) }}%</div>
            </div>
        </div>

        {% if total > 0 %}
        <h2>Results</h2>
        <table>
            <thead>
                <tr>
                    <th>File</th>
                    <th>Status</th>
                    <th>Max Deviation (₽)</th>
                    <th>Failed Fields</th>
                    <th>Products</th>
                </tr>
            </thead>
            <tbody>
                {% for result in results %}
                <tr class="{{ 'file-passed' if result.passed else 'file-failed' }}">
                    <td>{{ result.excel_file }}</td>
                    <td>
                        <span class="status-{{ 'passed' if result.passed else 'failed' }}">
                            {{ '✅ PASSED' if result.passed else '❌ FAILED' }}
                        </span>
                    </td>
                    <td>{{ "%.2f"|format(result.max_deviation) }}</td>
                    <td>
                        {% if result.failed_fields %}
                            {{ result.failed_fields|join(', ') }}
                        {% else %}
                            -
                        {% endif %}
                    </td>
                    <td>{{ result.total_products }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
        {% endif %}
    </div>
</body>
</html>
        """)

        return template.render(
            mode=mode,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            total=total,
            passed=passed,
            failed=failed,
            pass_rate=pass_rate,
            avg_dev=avg_dev,
            max_dev=max_dev,
            max_dev_file=max_dev_file,
            results=results
        )
