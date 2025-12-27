#!/usr/bin/env python3
"""
WorkSync Feature Completeness Analyzer
Analyzes codebase to identify incomplete features, missing functionality, and potential issues
"""

import os
import json
import re
import ast
from pathlib import Path
from typing import Dict, List, Any, Set
from datetime import datetime

class FeatureCompletenessAnalyzer:
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.backend_path = self.project_root / "backend"
        self.frontend_path = self.project_root / "frontend" / "src"
        self.analysis_results = {
            'backend': {},
            'frontend': {},
            'integration': {},
            'issues': [],
            'recommendations': []
        }
    
    def analyze_backend_models(self):
        """Analyze Django models for completeness"""
        print("Analyzing backend models...")
        models_analysis = {
            'apps': {},
            'missing_fields': [],
            'incomplete_models': [],
            'validation_issues': []
        }
        
        apps_path = self.backend_path / "apps"
        if not apps_path.exists():
            return models_analysis
        
        for app_dir in apps_path.iterdir():
            if app_dir.is_dir() and (app_dir / "models.py").exists():
                app_name = app_dir.name
                models_file = app_dir / "models.py"
                
                try:
                    with open(models_file, 'r') as f:
                        content = f.read()
                    
                    # Parse Python AST to find model classes
                    tree = ast.parse(content)
                    models = []
                    
                    for node in ast.walk(tree):
                        if isinstance(node, ast.ClassDef):
                            # Check if it's a Django model
                            for base in node.bases:
                                if isinstance(base, ast.Attribute) and base.attr == 'Model':
                                    models.append({
                                        'name': node.name,
                                        'line': node.lineno,
                                        'fields': self._extract_model_fields(node),
                                        'methods': self._extract_model_methods(node)
                                    })
                    
                    models_analysis['apps'][app_name] = {
                        'file': str(models_file),
                        'models': models,
                        'model_count': len(models)
                    }
                    
                    # Check for common issues
                    self._check_model_issues(app_name, models, content)
                    
                except Exception as e:
                    models_analysis['apps'][app_name] = {'error': str(e)}
        
        self.analysis_results['backend']['models'] = models_analysis
        return models_analysis
    
    def _extract_model_fields(self, class_node):
        """Extract field definitions from model class"""
        fields = []
        for node in class_node.body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        # Try to determine field type
                        field_type = "unknown"
                        if isinstance(node.value, ast.Call):
                            if isinstance(node.value.func, ast.Attribute):
                                field_type = node.value.func.attr
                            elif isinstance(node.value.func, ast.Name):
                                field_type = node.value.func.id
                        
                        fields.append({
                            'name': target.id,
                            'type': field_type,
                            'line': node.lineno
                        })
        return fields
    
    def _extract_model_methods(self, class_node):
        """Extract method definitions from model class"""
        methods = []
        for node in class_node.body:
            if isinstance(node, ast.FunctionDef):
                methods.append({
                    'name': node.name,
                    'line': node.lineno,
                    'args': [arg.arg for arg in node.args.args]
                })
        return methods
    
    def _check_model_issues(self, app_name, models, content):
        """Check for common model issues"""
        for model in models:
            model_name = model['name']
            
            # Check for missing __str__ method
            if not any(method['name'] == '__str__' for method in model['methods']):
                self.analysis_results['issues'].append({
                    'type': 'missing_str_method',
                    'severity': 'low',
                    'app': app_name,
                    'model': model_name,
                    'description': f"Model {model_name} missing __str__ method"
                })
            
            # Check for missing Meta class
            if 'class Meta:' not in content:
                self.analysis_results['issues'].append({
                    'type': 'missing_meta_class',
                    'severity': 'medium',
                    'app': app_name,
                    'model': model_name,
                    'description': f"Model {model_name} might be missing Meta class"
                })
    
    def analyze_backend_views(self):
        """Analyze Django views and API endpoints"""
        print("Analyzing backend views...")
        views_analysis = {
            'apps': {},
            'endpoints': [],
            'missing_permissions': [],
            'incomplete_crud': []
        }
        
        apps_path = self.backend_path / "apps"
        if not apps_path.exists():
            return views_analysis
        
        for app_dir in apps_path.iterdir():
            if app_dir.is_dir():
                app_name = app_dir.name
                views_file = app_dir / "views.py"
                urls_file = app_dir / "urls.py"
                
                app_analysis = {
                    'views_file_exists': views_file.exists(),
                    'urls_file_exists': urls_file.exists(),
                    'viewsets': [],
                    'function_views': [],
                    'url_patterns': []
                }
                
                # Analyze views.py
                if views_file.exists():
                    try:
                        with open(views_file, 'r') as f:
                            content = f.read()
                        
                        # Look for ViewSets
                        viewset_pattern = r'class\s+(\w+)\s*\([^)]*ViewSet[^)]*\):'
                        viewsets = re.findall(viewset_pattern, content)
                        app_analysis['viewsets'] = viewsets
                        
                        # Look for function-based views
                        function_view_pattern = r'@api_view\([^)]*\)\s*\ndef\s+(\w+)'
                        function_views = re.findall(function_view_pattern, content)
                        app_analysis['function_views'] = function_views
                        
                        # Check for permission classes
                        if 'permission_classes' not in content:
                            self.analysis_results['issues'].append({
                                'type': 'missing_permissions',
                                'severity': 'high',
                                'app': app_name,
                                'description': f"Views in {app_name} may be missing permission classes"
                            })
                        
                    except Exception as e:
                        app_analysis['error'] = str(e)
                
                # Analyze urls.py
                if urls_file.exists():
                    try:
                        with open(urls_file, 'r') as f:
                            content = f.read()
                        
                        # Extract URL patterns
                        url_pattern = r"path\(['\"]([^'\"]+)['\"]"
                        urls = re.findall(url_pattern, content)
                        app_analysis['url_patterns'] = urls
                        
                    except Exception as e:
                        app_analysis['urls_error'] = str(e)
                
                views_analysis['apps'][app_name] = app_analysis
        
        self.analysis_results['backend']['views'] = views_analysis
        return views_analysis
    
    def analyze_frontend_components(self):
        """Analyze React components for completeness"""
        print("Analyzing frontend components...")
        components_analysis = {
            'components': {},
            'pages': {},
            'missing_error_handling': [],
            'incomplete_components': []
        }
        
        if not self.frontend_path.exists():
            return components_analysis
        
        # Analyze components directory
        components_dir = self.frontend_path / "components"
        if components_dir.exists():
            for component_file in components_dir.glob("*.js"):
                component_name = component_file.stem
                analysis = self._analyze_react_component(component_file)
                components_analysis['components'][component_name] = analysis
        
        # Analyze pages directory
        pages_dir = self.frontend_path / "pages"
        if pages_dir.exists():
            for page_file in pages_dir.glob("*.js"):
                page_name = page_file.stem
                analysis = self._analyze_react_component(page_file)
                components_analysis['pages'][page_name] = analysis

        # CRITICAL: Analyze break button functionality specifically
        break_button_issues = self._analyze_break_button_functionality()
        components_analysis['break_button_analysis'] = break_button_issues

        self.analysis_results['frontend']['components'] = components_analysis
        return components_analysis
    
    def _analyze_react_component(self, file_path):
        """Analyze individual React component"""
        try:
            with open(file_path, 'r') as f:
                content = f.read()
            
            analysis = {
                'file': str(file_path),
                'has_error_boundary': 'ErrorBoundary' in content or 'componentDidCatch' in content,
                'has_loading_state': 'loading' in content.lower() or 'isLoading' in content,
                'has_error_handling': 'catch' in content or 'error' in content.lower(),
                'uses_hooks': any(hook in content for hook in ['useState', 'useEffect', 'useContext']),
                'has_prop_types': 'PropTypes' in content,
                'imports': self._extract_imports(content),
                'exports': self._extract_exports(content)
            }
            
            # Check for common issues
            if not analysis['has_error_handling']:
                self.analysis_results['issues'].append({
                    'type': 'missing_error_handling',
                    'severity': 'medium',
                    'file': str(file_path),
                    'description': f"Component {file_path.stem} lacks error handling"
                })
            
            return analysis
            
        except Exception as e:
            return {'error': str(e)}
    
    def _extract_imports(self, content):
        """Extract import statements from React component"""
        import_pattern = r"import\s+(?:{[^}]+}|\w+|\*\s+as\s+\w+)\s+from\s+['\"]([^'\"]+)['\"]"
        imports = re.findall(import_pattern, content)
        return imports
    
    def _extract_exports(self, content):
        """Extract export statements from React component"""
        export_pattern = r"export\s+(?:default\s+)?(?:const\s+|function\s+|class\s+)?(\w+)"
        exports = re.findall(export_pattern, content)
        return exports
    
    def analyze_integration_points(self):
        """Analyze API integration and data flow"""
        print("Analyzing integration points...")
        integration_analysis = {
            'api_endpoints_used': [],
            'websocket_usage': False,
            'missing_api_calls': [],
            'error_handling_coverage': {}
        }
        
        # Check frontend API usage
        api_file = self.frontend_path / "services" / "api.js"
        if api_file.exists():
            try:
                with open(api_file, 'r') as f:
                    content = f.read()
                
                # Extract API endpoint definitions
                endpoint_pattern = r"(\w+):\s*\([^)]*\)\s*=>\s*api\.(get|post|put|delete)\(['\"]([^'\"]+)['\"]"
                endpoints = re.findall(endpoint_pattern, content)
                integration_analysis['api_endpoints_used'] = [
                    {'name': name, 'method': method, 'url': url} 
                    for name, method, url in endpoints
                ]
                
                # Check for WebSocket usage
                integration_analysis['websocket_usage'] = 'WebSocket' in content or 'socket.io' in content
                
            except Exception as e:
                integration_analysis['api_analysis_error'] = str(e)
        
        self.analysis_results['integration'] = integration_analysis
        return integration_analysis
    
    def generate_recommendations(self):
        """Generate recommendations based on analysis"""
        print("Generating recommendations...")
        recommendations = []
        
        # Backend recommendations
        if 'models' in self.analysis_results['backend']:
            models_data = self.analysis_results['backend']['models']
            if len(models_data.get('apps', {})) == 0:
                recommendations.append({
                    'category': 'backend',
                    'priority': 'high',
                    'title': 'No Django models found',
                    'description': 'Backend appears to be missing model definitions'
                })
        
        # Frontend recommendations
        if 'components' in self.analysis_results['frontend']:
            components_data = self.analysis_results['frontend']['components']
            if len(components_data.get('components', {})) == 0:
                recommendations.append({
                    'category': 'frontend',
                    'priority': 'high',
                    'title': 'No React components found',
                    'description': 'Frontend appears to be missing component definitions'
                })
        
        # Issue-based recommendations
        high_severity_issues = [issue for issue in self.analysis_results['issues'] 
                               if issue.get('severity') == 'high']
        if high_severity_issues:
            recommendations.append({
                'category': 'security',
                'priority': 'high',
                'title': f'{len(high_severity_issues)} high-severity issues found',
                'description': 'Address security and permission issues immediately'
            })
        
        self.analysis_results['recommendations'] = recommendations
        return recommendations
    
    def run_full_analysis(self):
        """Run complete feature analysis"""
        print("Starting WorkSync Feature Completeness Analysis...")
        print(f"Project root: {self.project_root}")
        
        start_time = datetime.now()
        
        # Run all analysis modules
        self.analyze_backend_models()
        self.analyze_backend_views()
        self.analyze_frontend_components()
        self.analyze_integration_points()
        self.generate_recommendations()
        
        # Generate summary
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        summary = {
            'analysis_timestamp': start_time.isoformat(),
            'duration_seconds': duration,
            'total_issues': len(self.analysis_results['issues']),
            'high_priority_issues': len([i for i in self.analysis_results['issues'] 
                                       if i.get('severity') == 'high']),
            'recommendations_count': len(self.analysis_results['recommendations'])
        }
        
        self.analysis_results['summary'] = summary
        
        # Save results
        output_file = 'feature_completeness_analysis.json'
        with open(output_file, 'w') as f:
            json.dump(self.analysis_results, f, indent=2, default=str)
        
        print(f"\n{'='*50}")
        print("FEATURE COMPLETENESS ANALYSIS SUMMARY")
        print(f"{'='*50}")
        print(f"Analysis Duration: {duration:.2f}s")
        print(f"Total Issues Found: {summary['total_issues']}")
        print(f"High Priority Issues: {summary['high_priority_issues']}")
        print(f"Recommendations: {summary['recommendations_count']}")
        print(f"\nDetailed analysis saved to: {output_file}")
        
        return self.analysis_results

    def _analyze_break_button_functionality(self):
        """Analyze break button functionality for critical issues"""
        print("🔍 Analyzing break button functionality...")

        issues = []

        # Check BreakButton.js
        break_button_path = self.frontend_path / "components" / "BreakButton.js"
        if break_button_path.exists():
            try:
                with open(break_button_path, 'r') as f:
                    content = f.read()

                # Check for critical break button issues

                # Issue 1: Check if break requirements logic is too restrictive
                if 'requiresBreak' in content and 'breakRequirements?.data?.requires_break' in content:
                    issues.append({
                        'type': 'CRITICAL',
                        'component': 'BreakButton.js',
                        'issue': 'Break button uses nested data structure (breakRequirements?.data?.requires_break) which may cause undefined values',
                        'line_context': 'const requiresBreak = breakRequirements?.data?.requires_break;',
                        'impact': 'Break button will always be greyed out if API returns flat structure',
                        'fix_suggestion': 'Verify API response structure and adjust data access pattern'
                    })

                # Issue 2: Check for default disabled state
                if 'Break Not Due' in content and 'bg-gray-300' in content:
                    issues.append({
                        'type': 'CRITICAL',
                        'component': 'BreakButton.js',
                        'issue': 'Break button defaults to disabled/greyed out state when break not required',
                        'line_context': 'buttonText = "Break Not Due"; isDisabled = true;',
                        'impact': 'Button appears greyed out most of the time, confusing users',
                        'fix_suggestion': 'Add visual feedback for when breaks will be available or allow manual break requests'
                    })

                # Issue 3: Check for API endpoint issues
                if '/breaks/start_break/' in content and 'POST' in content:
                    issues.append({
                        'type': 'HIGH',
                        'component': 'BreakButton.js',
                        'issue': 'Potential API endpoint mismatch for break operations',
                        'line_context': "attendanceAPI.post('/breaks/start_break/', breakData)",
                        'impact': 'Break start/end operations may fail with 405 Method Not Allowed',
                        'fix_suggestion': 'Verify backend API expects POST method for break operations'
                    })

                # Issue 4: Check for break requirements query enablement
                if 'enabled: !!currentStatus?.is_clocked_in' in content:
                    issues.append({
                        'type': 'HIGH',
                        'component': 'BreakButton.js',
                        'issue': 'Break requirements query only enabled when clocked in status is confirmed',
                        'line_context': 'enabled: !!currentStatus?.is_clocked_in',
                        'impact': 'If currentStatus is undefined/null, break requirements never load',
                        'fix_suggestion': 'Add fallback logic or better error handling for currentStatus'
                    })

            except Exception as e:
                issues.append({
                    'type': 'ERROR',
                    'component': 'BreakButton.js',
                    'issue': f'Failed to analyze break button file: {str(e)}',
                    'impact': 'Cannot determine break button functionality',
                    'fix_suggestion': 'Check file permissions and syntax'
                })
        else:
            issues.append({
                'type': 'CRITICAL',
                'component': 'BreakButton.js',
                'issue': 'BreakButton component file not found',
                'impact': 'Break functionality completely missing from frontend',
                'fix_suggestion': 'Create BreakButton component or verify file location'
            })

        return {
            'total_issues': len(issues),
            'critical_issues': len([i for i in issues if i['type'] == 'CRITICAL']),
            'high_issues': len([i for i in issues if i['type'] == 'HIGH']),
            'issues': issues,
            'summary': f"Found {len(issues)} break button issues: {len([i for i in issues if i['type'] == 'CRITICAL'])} critical, {len([i for i in issues if i['type'] == 'HIGH'])} high priority"
        }

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='WorkSync Feature Completeness Analyzer')
    parser.add_argument('--project-root', default='.', 
                       help='Root directory of the WorkSync project')
    
    args = parser.parse_args()
    
    analyzer = FeatureCompletenessAnalyzer(args.project_root)
    analyzer.run_full_analysis()
