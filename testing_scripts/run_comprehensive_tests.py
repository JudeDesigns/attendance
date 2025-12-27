#!/usr/bin/env python3
"""
WorkSync Comprehensive Testing Runner
Orchestrates all testing phases and generates consolidated reports
"""

import os
import sys
import json
import subprocess
import time
from datetime import datetime
from pathlib import Path
import argparse

class ComprehensiveTestRunner:
    def __init__(self, project_root=".", backend_url="http://localhost:8000",
                 frontend_url="http://localhost:3000"):
        self.project_root = Path(project_root)
        self.backend_url = backend_url
        self.frontend_url = frontend_url
        self.backend_path = self.project_root / "backend"
        self.venv_path = self.backend_path / "venv"
        self.python_executable = self.get_venv_python()
        self.test_results = {
            'backend_api': {},
            'frontend_components': {},
            'feature_analysis': {},
            'integration_tests': {},
            'summary': {}
        }
        self.start_time = datetime.now()

    def get_venv_python(self):
        """Get the Python executable from the virtual environment"""
        if self.venv_path.exists():
            # Check for different possible Python executable names
            for python_name in ['python', 'python3', 'python3.11']:
                python_path = self.venv_path / "bin" / python_name
                if python_path.exists():
                    return str(python_path)

        # Fallback to system Python
        return sys.executable
    
    def check_prerequisites(self):
        """Check if required services are running"""
        print("Checking prerequisites...")
        
        # Check if backend is running
        try:
            import requests
            response = requests.get(f"{self.backend_url}/api/v1/", timeout=5)
            backend_running = response.status_code in [200, 404]  # 404 is OK, means server is up
        except:
            backend_running = False
        
        # Check if frontend is running
        try:
            import requests
            response = requests.get(self.frontend_url, timeout=5)
            frontend_running = response.status_code == 200
        except:
            frontend_running = False
        
        print(f"Backend ({self.backend_url}): {'✅ Running' if backend_running else '❌ Not running'}")
        print(f"Frontend ({self.frontend_url}): {'✅ Running' if frontend_running else '❌ Not running'}")
        
        return backend_running, frontend_running
    
    def run_backend_tests(self):
        """Run backend API tests"""
        print(f"\n{'='*50}")
        print("PHASE 1: BACKEND API TESTING")
        print(f"{'='*50}")

        try:
            # Run the backend API tester using venv Python
            script_path = self.project_root / "testing_scripts" / "backend_api_tester.py"
            result = subprocess.run([
                self.python_executable, str(script_path), "--url", self.backend_url
            ], capture_output=True, text=True, cwd=self.project_root)

            print(result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)

            # Load results if available
            results_file = self.project_root / "api_test_results.json"
            if results_file.exists():
                with open(results_file, 'r') as f:
                    self.test_results['backend_api'] = json.load(f)

            return result.returncode == 0

        except Exception as e:
            print(f"❌ Backend testing failed: {e}")
            return False
    
    def run_frontend_tests(self):
        """Run frontend component tests"""
        print(f"\n{'='*50}")
        print("PHASE 2: FRONTEND COMPONENT TESTING")
        print(f"{'='*50}")
        
        try:
            # Check if Node.js and required packages are available
            node_modules = self.project_root / "testing_scripts" / "node_modules"
            if not node_modules.exists():
                print("Installing Node.js dependencies for frontend testing...")
                subprocess.run([
                    "npm", "install", "puppeteer"
                ], cwd=self.project_root / "testing_scripts", check=True)
            
            # Run the frontend tester
            script_path = self.project_root / "testing_scripts" / "frontend_component_tester.js"
            result = subprocess.run([
                "node", str(script_path), self.frontend_url
            ], capture_output=True, text=True, cwd=self.project_root)
            
            print(result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)
            
            # Load results if available
            results_file = self.project_root / "frontend_test_results.json"
            if results_file.exists():
                with open(results_file, 'r') as f:
                    self.test_results['frontend_components'] = json.load(f)
            
            return result.returncode == 0
            
        except Exception as e:
            print(f"❌ Frontend testing failed: {e}")
            print("Note: Frontend testing requires Node.js and puppeteer")
            return False
    
    def run_feature_analysis(self):
        """Run feature completeness analysis"""
        print(f"\n{'='*50}")
        print("PHASE 3: FEATURE COMPLETENESS ANALYSIS")
        print(f"{'='*50}")

        try:
            # Run the feature analyzer using venv Python
            script_path = self.project_root / "testing_scripts" / "feature_completeness_analyzer.py"
            result = subprocess.run([
                self.python_executable, str(script_path), "--project-root", str(self.project_root)
            ], capture_output=True, text=True, cwd=self.project_root)

            print(result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)

            # Load results if available
            results_file = self.project_root / "feature_completeness_analysis.json"
            if results_file.exists():
                with open(results_file, 'r') as f:
                    self.test_results['feature_analysis'] = json.load(f)

            return result.returncode == 0

        except Exception as e:
            print(f"❌ Feature analysis failed: {e}")
            return False

    def run_break_button_tests(self):
        """Run specific break button functionality tests"""
        print(f"\n{'='*50}")
        print("PHASE 3.5: BREAK BUTTON FUNCTIONALITY TESTING")
        print(f"{'='*50}")

        try:
            # Run break button specific tests
            result = subprocess.run([
                self.python_executable,
                str(self.project_root / "testing_scripts" / "break_button_tester.py")
            ],
            cwd=self.project_root,
            capture_output=True,
            text=True,
            timeout=300
            )

            print(result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)

            # Load results if available
            results_file = self.project_root / "break_button_test_results.json"
            if results_file.exists():
                with open(results_file, 'r') as f:
                    self.test_results['break_button_tests'] = json.load(f)

            return result.returncode == 0

        except Exception as e:
            print(f"❌ Break button tests failed: {e}")
            return False

    def run_integration_tests(self):
        """Run integration tests"""
        print(f"\n{'='*50}")
        print("PHASE 4: INTEGRATION TESTING")
        print(f"{'='*50}")
        
        # For now, this is a placeholder for manual integration tests
        # In a full implementation, this would include:
        # - API-Frontend data flow tests
        # - WebSocket connection tests
        # - End-to-end workflow tests
        
        integration_results = {
            'api_frontend_integration': 'MANUAL_REQUIRED',
            'websocket_connectivity': 'MANUAL_REQUIRED',
            'end_to_end_workflows': 'MANUAL_REQUIRED',
            'mobile_responsiveness': 'MANUAL_REQUIRED'
        }
        
        self.test_results['integration_tests'] = integration_results
        
        print("Integration tests require manual execution:")
        print("1. Test API-Frontend data flow")
        print("2. Verify WebSocket connections")
        print("3. Test end-to-end user workflows")
        print("4. Validate mobile responsiveness")
        
        return True
    
    def generate_consolidated_report(self):
        """Generate consolidated test report"""
        print(f"\n{'='*50}")
        print("GENERATING CONSOLIDATED REPORT")
        print(f"{'='*50}")
        
        end_time = datetime.now()
        total_duration = (end_time - self.start_time).total_seconds()
        
        # Calculate overall statistics
        total_tests = 0
        total_passed = 0
        total_failed = 0
        total_errors = 0
        
        # Backend API stats
        if 'summary' in self.test_results['backend_api']:
            backend_summary = self.test_results['backend_api']['summary']
            total_tests += backend_summary.get('total', 0)
            total_passed += backend_summary.get('passed', 0)
            total_failed += backend_summary.get('failed', 0)
            total_errors += backend_summary.get('errors', 0)
        
        # Frontend component stats
        if 'summary' in self.test_results['frontend_components']:
            frontend_summary = self.test_results['frontend_components']['summary']
            total_tests += frontend_summary.get('total', 0)
            total_passed += frontend_summary.get('passed', 0)
            total_failed += frontend_summary.get('failed', 0)
            total_errors += frontend_summary.get('errors', 0)
        
        # Feature analysis stats
        if 'summary' in self.test_results['feature_analysis']:
            analysis_summary = self.test_results['feature_analysis']['summary']
            total_issues = analysis_summary.get('total_issues', 0)
            high_priority_issues = analysis_summary.get('high_priority_issues', 0)
        else:
            total_issues = 0
            high_priority_issues = 0
        
        # Create consolidated summary
        consolidated_summary = {
            'test_execution': {
                'start_time': self.start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'total_duration_seconds': total_duration,
                'backend_url': self.backend_url,
                'frontend_url': self.frontend_url
            },
            'test_statistics': {
                'total_tests': total_tests,
                'passed': total_passed,
                'failed': total_failed,
                'errors': total_errors,
                'success_rate': (total_passed / total_tests * 100) if total_tests > 0 else 0
            },
            'feature_analysis': {
                'total_issues': total_issues,
                'high_priority_issues': high_priority_issues,
                'recommendations': len(self.test_results['feature_analysis'].get('recommendations', []))
            },
            'phases_completed': {
                'backend_api_testing': bool(self.test_results['backend_api']),
                'frontend_component_testing': bool(self.test_results['frontend_components']),
                'feature_analysis': bool(self.test_results['feature_analysis']),
                'integration_testing': bool(self.test_results['integration_tests'])
            }
        }
        
        self.test_results['summary'] = consolidated_summary
        
        # Save consolidated report
        report_file = f"comprehensive_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(self.test_results, f, indent=2, default=str)
        
        # Print summary
        print(f"Total Tests Executed: {total_tests}")
        print(f"Passed: {total_passed}")
        print(f"Failed: {total_failed}")
        print(f"Errors: {total_errors}")
        print(f"Success Rate: {consolidated_summary['test_statistics']['success_rate']:.1f}%")
        print(f"Feature Issues Found: {total_issues}")
        print(f"High Priority Issues: {high_priority_issues}")
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"\nConsolidated report saved to: {report_file}")
        
        return consolidated_summary
    
    def run_all_tests(self):
        """Run all testing phases"""
        print("🚀 Starting WorkSync Comprehensive Testing Suite")
        print(f"Project Root: {self.project_root}")
        print(f"Backend URL: {self.backend_url}")
        print(f"Frontend URL: {self.frontend_url}")
        
        # Check prerequisites
        backend_running, frontend_running = self.check_prerequisites()
        
        # Run testing phases
        phases_results = {}
        
        if backend_running:
            phases_results['backend'] = self.run_backend_tests()
        else:
            print("⚠️  Skipping backend tests - backend not running")
            phases_results['backend'] = False
        
        if frontend_running:
            phases_results['frontend'] = self.run_frontend_tests()
        else:
            print("⚠️  Skipping frontend tests - frontend not running")
            phases_results['frontend'] = False
        
        phases_results['analysis'] = self.run_feature_analysis()
        phases_results['break_button'] = self.run_break_button_tests()
        phases_results['integration'] = self.run_integration_tests()
        
        # Generate consolidated report
        summary = self.generate_consolidated_report()
        
        # Final status
        print(f"\n{'='*50}")
        print("TESTING COMPLETE")
        print(f"{'='*50}")
        
        successful_phases = sum(1 for result in phases_results.values() if result)
        total_phases = len(phases_results)
        
        print(f"Phases Completed: {successful_phases}/{total_phases}")
        
        if successful_phases == total_phases:
            print("✅ All testing phases completed successfully!")
        elif successful_phases > 0:
            print("⚠️  Some testing phases completed with issues")
        else:
            print("❌ Testing failed - check service availability")
        
        return summary

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='WorkSync Comprehensive Test Runner')
    parser.add_argument('--project-root', default='.', help='Project root directory')
    parser.add_argument('--backend-url', default='http://localhost:8000', help='Backend URL')
    parser.add_argument('--frontend-url', default='http://localhost:3000', help='Frontend URL')
    
    args = parser.parse_args()
    
    runner = ComprehensiveTestRunner(
        project_root=args.project_root,
        backend_url=args.backend_url,
        frontend_url=args.frontend_url
    )
    
    runner.run_all_tests()
