import 'dart:async';
import 'dart:io';

// Example Dart file demonstrating Dart AI Assistant features

/// This file demonstrates various features of Dart AI Assistant
///
/// Features demonstrated:
/// - Auto-correction
/// - Code completion
/// - Security scanning
/// - Smart refactoring
/// - Pattern learning
/// - Code formatting

// ============================================
// 1. AUTO-CORRECTION EXAMPLES
// ============================================

// Example 1: Missing semicolon (auto-fixed with Ctrl+Shift+F)
void demonstrateMissingSemicolon() {
  String message = "Hello World";
  print(message);
}

// Example 2: Undefined variable detection
void demonstrateUndefinedVariable() {
  // The extension will warn about undefined variables
  var name = "John";
  print(name);
}

// Example 3: Type mismatch detection
void demonstrateTypeMismatch() {
  int number = 42;
  String text = "42";
  // Extension warns if you try: int x = text;
  print('Number: $number, Text: $text');
}

// ============================================
// 2. SECURITY SCANNING EXAMPLES
// ============================================

class SecurityExamples {
  // ⚠️ Security Scanner will flag this
  // ISSUE: Hardcoded API key
  final String apiKey = "sk-1234567890abcdefghijklmnop";

  // ✅ Better approach (suggested by scanner)
  String getApiKey() {
    return Platform.environment['API_KEY'] ?? '';
  }

  // ⚠️ Security Scanner will flag this
  // ISSUE: SQL Injection vulnerability
  Future<List<User>> getUsersUnsafe(String username) async {
    final query = "SELECT * FROM users WHERE name = '$username'";
    // Execute query...
    print(query);
    return [];
  }

  // ✅ Better approach (suggested by scanner)
  Future<List<User>> getUsersSafe(String username) async {
    final query = "SELECT * FROM users WHERE name = ?";
    // Use parameterized query...
    print(query);
    return [];
  }

  // ⚠️ Security Scanner will flag this
  // ISSUE: Insecure HTTP
  Future<void> fetchDataInsecure() async {
    final url = 'http://api.example.com/data';
    print('Fetching from: $url');
    // Fetch data...
  }

  // ✅ Better approach
  Future<void> fetchDataSecure() async {
    final url = 'https://api.example.com/data';
    print('Fetching from: $url');
    // Fetch data...
  }
}

// ============================================
// 3. CODE COMPLETION EXAMPLES
// ============================================

// Type "Fut" and press Ctrl+Space for smart completion
Future<String> asyncExample() async {
  await Future.delayed(Duration(seconds: 1));
  return "Completed";
}

// Type "Stream" for stream completion
Stream<int> streamExample() async* {
  for (int i = 0; i < 10; i++) {
    yield i;
    await Future.delayed(Duration(milliseconds: 100));
  }
}

// ============================================
// 4. FLUTTER WIDGET EXAMPLES (commented out as they need Flutter)
// ============================================

/*
// Uncomment these if you have Flutter installed

import 'package:flutter/material.dart';

// Type "stless" for StatelessWidget snippet
class MyStatelessWidget extends StatelessWidget {
  const MyStatelessWidget({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      child: Text('Hello'),
    );
  }
}

// Type "stful" for StatefulWidget snippet
class MyStatefulWidget extends StatefulWidget {
  const MyStatefulWidget({Key? key}) : super(key: key);

  @override
  _MyStatefulWidgetState createState() => _MyStatefulWidgetState();
}

class _MyStatefulWidgetState extends State<MyStatefulWidget> {
  int _counter = 0;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('Count: $_counter'),
        ElevatedButton(
          onPressed: () {
            setState(() {
              _counter++;
            });
          },
          child: Text('Increment'),
        ),
      ],
    );
  }
}
*/

// ============================================
// 5. REFACTORING EXAMPLES
// ============================================

// Select this code and run "Dart AI: Intelligent Refactor"
class RefactoringExample {
  // This can be refactored to use getter/setter
  String _name = '';

  void setName(String name) {
    _name = name;
  }

  String getName() {
    return _name;
  }

  // AI will suggest:
  // String get name => _name;
  // set name(String value) => _name = value;
}

// Complex loop that can be optimized
List<int> doubleNumbers(List<int> numbers) {
  List<int> result = [];
  for (int i = 0; i < numbers.length; i++) {
    result.add(numbers[i] * 2);
  }
  return result;

  // AI suggests: return numbers.map((n) => n * 2).toList();
}

// ============================================
// 6. NULL SAFETY EXAMPLES
// ============================================

class NullSafetyExample {
  String? nullableName;
  String nonNullableName = "John";

  void printName() {
    // Extension suggests null-aware operator
    print(nullableName?.toUpperCase() ?? 'No name');

    // Or null check
    if (nullableName != null) {
      print(nullableName!.toUpperCase());
    }
  }
}

// ============================================
// 7. ASYNC/AWAIT PATTERNS
// ============================================

class AsyncPatterns {
  // Parallel execution
  Future<void> parallelExample() async {
    final results = await Future.wait([
      fetchUser(),
      fetchPosts(),
      fetchComments(),
    ]);
    print('Fetched ${results.length} results');
  }

  // Error handling
  Future<void> errorHandlingExample() async {
    try {
      final data = await fetchData();
      processData(data);
    } catch (e) {
      print('Error: $e');
    } finally {
      cleanup();
    }
  }

  // Timeout handling
  Future<void> timeoutExample() async {
    try {
      final result = await fetchData().timeout(Duration(seconds: 5));
      print('Result: $result');
    } on TimeoutException {
      print('Operation timed out');
    }
  }
}

// ============================================
// 8. CODE OPTIMIZATION EXAMPLES
// ============================================

class OptimizationExamples {
  // Before optimization (select and run "Dart AI: Optimize Code")
  List<String> getActiveUserNames(List<User> users) {
    List<String> result = [];
    for (var user in users) {
      if (user.isActive) {
        result.add(user.name);
      }
    }
    return result;
  }

  // After optimization (AI suggestion)
  List<String> getActiveUserNamesOptimized(List<User> users) {
    return users
        .where((user) => user.isActive)
        .map((user) => user.name)
        .toList();
  }

  // Inefficient string concatenation
  String buildMessage(List<String> parts) {
    String message = '';
    for (var part in parts) {
      message += part + ' ';
    }
    return message;
  }

  // Optimized version (AI suggestion)
  String buildMessageOptimized(List<String> parts) {
    return parts.join(' ');
  }
}

// ============================================
// 9. TEST GENERATION EXAMPLE
// ============================================

// Select this class and run "Dart AI: Generate Tests"
class Calculator {
  int add(int a, int b) => a + b;

  int subtract(int a, int b) => a - b;

  int multiply(int a, int b) => a * b;

  double divide(int a, int b) {
    if (b == 0) throw ArgumentError('Cannot divide by zero');
    return a / b;
  }
}

// AI will generate:
// - Test file: calculator_test.dart
// - Tests for each method
// - Edge case tests
// - Error scenario tests

// ============================================
// 10. LEARNING ENGINE EXAMPLES
// ============================================

// The learning engine will notice your patterns:

// If you consistently use camelCase:
class MyServiceClass {
  String userName = '';
  int userAge = 0;
  bool isActive = true;

  void printInfo() {
    print('User: $userName, Age: $userAge, Active: $isActive');
  }
}

// If you prefer factory constructors:
class User {
  final String name;
  final int age;
  final bool isActive;

  User(this.name, this.age, this.isActive);

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      json['name'] as String,
      json['age'] as int,
      json['isActive'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {'name': name, 'age': age, 'isActive': isActive};
  }
}

// If you use specific import patterns:
// The engine learns your preferred packages and suggests them

// ============================================
// HELPER FUNCTIONS
// ============================================

Future<User> fetchUser() async {
  await Future.delayed(Duration(milliseconds: 100));
  return User('John', 30, true);
}

Future<List<String>> fetchPosts() async {
  await Future.delayed(Duration(milliseconds: 100));
  return ['Post 1', 'Post 2'];
}

Future<List<String>> fetchComments() async {
  await Future.delayed(Duration(milliseconds: 100));
  return ['Comment 1', 'Comment 2'];
}

Future<String> fetchData() async {
  await Future.delayed(Duration(milliseconds: 100));
  return 'data';
}

void processData(String data) {
  print('Processing: $data');
}

void cleanup() {
  print('Cleaning up...');
}

// ============================================
// 11. COLLECTION OPERATIONS
// ============================================

class CollectionExamples {
  // Map operations
  void demonstrateMap() {
    final numbers = [1, 2, 3, 4, 5];
    final doubled = numbers.map((n) => n * 2).toList();
    print('Doubled: $doubled');
  }

  // Filter operations
  void demonstrateFilter() {
    final numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    final evens = numbers.where((n) => n % 2 == 0).toList();
    print('Even numbers: $evens');
  }

  // Reduce operations
  void demonstrateReduce() {
    final numbers = [1, 2, 3, 4, 5];
    final sum = numbers.reduce((a, b) => a + b);
    print('Sum: $sum');
  }

  // Combining operations
  void demonstrateCombined() {
    final numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    final result = numbers.where((n) => n % 2 == 0).map((n) => n * 2).toList();
    print('Even numbers doubled: $result');
  }
}

// ============================================
// 12. ERROR HANDLING PATTERNS
// ============================================

class ErrorHandlingExamples {
  // Try-catch with specific exceptions
  void handleSpecificErrors() {
    try {
      // Some operation
      throw FormatException('Invalid format');
      // Unable to auto-fix offline — check Dart docs
      print('Format error: $e');
      // Unable to auto-fix offline — check Dart docs
      print('IO error: $e');
    } catch (e) {
      print('Unknown error: $e');
    }
  }

  void testFunction() {
    try {
      print('test');
    } catch (e) {
      print('error: $e');
    }
  }

  // Try-catch-finally
  void handleWithFinally() {
    try {
      // Some operation
      print('Attempting operation...');
    } catch (e) {
      print('Error occurred: $e');
    } finally {
      print('Cleanup performed');
    }
  }

  // Rethrowing exceptions
  Future<void> rethrowExample() async {
    try {
      await fetchData();
    } catch (e) {
      print('Error in rethrowExample: $e');
      rethrow;
    }
  }
}

// ============================================
// MAIN FUNCTION
// ============================================

void main() async {
  print('='.padRight(60, '='));
  print('Dart AI Assistant - Feature Demonstration');
  print('='.padRight(60, '='));
  print('');

  print('Try the following:');
  print('1. Press Ctrl+Shift+F to fix errors');
  print('2. Press Ctrl+Space for completions');
  print('3. Run "Dart AI: Security Scan" from command palette');
  print('4. Select code and run "Dart AI: Optimize Code"');
  print('5. Run "Dart AI: Generate Tests" on Calculator class');
  print('');

  // Demo some features
  print('Running some examples...');
  print('');

  // Async example
  print('Testing async function...');
  final result = await asyncExample();
  print('Result: $result');
  print('');

  // Stream example
  print('Testing stream...');
  await for (final value in streamExample().take(3)) {
    print('Stream value: $value');
  }
  print('');

  // Calculator example
  print('Testing Calculator...');
  final calc = Calculator();
  print('5 + 3 = ${calc.add(5, 3)}');
  print('5 - 3 = ${calc.subtract(5, 3)}');
  print('5 * 3 = ${calc.multiply(5, 3)}');
  print('6 / 2 = ${calc.divide(6, 2)}');
  print('');

  // Collection examples
  print('Testing collection operations...');
  final collections = CollectionExamples();
  collections.demonstrateMap();
  collections.demonstrateFilter();
  collections.demonstrateReduce();
  collections.demonstrateCombined();
  print('');

  print('Demo completed! 🎉');
  print('Now try using the extension features on this file.');
}
