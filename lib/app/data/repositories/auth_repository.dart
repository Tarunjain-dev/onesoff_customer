import 'package:dio/dio.dart';
import 'package:onesoff_customer/app/data/api/api_client.dart';
import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/data/storage/auth_storage.dart';

class AuthRepository {
  AuthRepository(this._apiClient, this._authStorage);

  final ApiClient _apiClient;
  final AuthStorage _authStorage;

  Future<void> sendOtp({required String phone}) async {
    await _apiClient.dio.post<dynamic>(
      ApiEndpoints.sendOtp,
      data: <String, dynamic>{'phone': phone},
      options: Options(extra: <String, dynamic>{'skipAuth': true}),
    );
  }

  Future<AuthSession> verifyOtp({
    required String phone,
    required String otp,
    String? name,
    String? email,
    String? aadhar,
  }) async {
    final Map<String, dynamic> payload = <String, dynamic>{
      'phone': phone,
      'otp': otp,
      if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
      if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      if (aadhar != null && aadhar.trim().isNotEmpty) 'aadhar': aadhar.trim(),
    };

    final Response<dynamic> response = await _apiClient.dio.post<dynamic>(
      ApiEndpoints.verifyOtp,
      data: payload,
      options: Options(extra: <String, dynamic>{'skipAuth': true}),
    );

    final AuthSession session = AuthSession.fromResponse(response.data);
    await _authStorage.saveSession(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      customerId: session.customerId,
      userId: session.userId,
      role: session.role,
    );
    return session;
  }

  Future<bool> restoreSession() async {
    final String? accessToken = await _authStorage.getAccessToken();
    final String? refreshToken = await _authStorage.getRefreshToken();
    if ((accessToken == null || accessToken.isEmpty) &&
        (refreshToken == null || refreshToken.isEmpty)) {
      return false;
    }

    try {
      await _apiClient.dio.get<dynamic>(ApiEndpoints.authCustomerProfile);
      return true;
    } catch (_) {
      await _authStorage.clearSession();
      return false;
    }
  }

  Future<void> logout() async {
    final String? refreshToken = await _authStorage.getRefreshToken();
    try {
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _apiClient.dio.post<dynamic>(
          ApiEndpoints.logout,
          data: <String, dynamic>{'refreshToken': refreshToken},
        );
      }
    } finally {
      await _authStorage.clearSession();
    }
  }
}

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    this.customerId,
    this.userId,
    this.role,
    this.phone,
    this.email,
    this.name,
  });

  final String accessToken;
  final String refreshToken;
  final String? customerId;
  final String? userId;
  final String? role;
  final String? phone;
  final String? email;
  final String? name;

  factory AuthSession.fromResponse(dynamic response) {
    final Map<String, dynamic> body = _asMap(response);
    final Map<String, dynamic> data = _dataMap(body);

    final String? accessToken = _deepFindString(data, const <String>[
      'accessToken',
      'token',
    ]);
    final String? refreshToken = _deepFindString(data, const <String>[
      'refreshToken',
    ]);

    if (accessToken == null || refreshToken == null) {
      throw const FormatException('Auth response did not include tokens.');
    }

    return AuthSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      customerId: _deepFindString(data, const <String>['customerId']),
      userId: _deepFindString(data, const <String>['userId', 'id']),
      role: _deepFindString(data, const <String>['role']),
      phone: _deepFindString(data, const <String>['phone']),
      email: _deepFindString(data, const <String>['email']),
      name: _deepFindString(data, const <String>['name']),
    );
  }

  static Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  static Map<String, dynamic> _dataMap(Map<String, dynamic> body) {
    final dynamic data = body['data'];
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return body;
  }

  static String? _deepFindString(
    Map<String, dynamic> source,
    List<String> keys,
  ) {
    for (final String key in keys) {
      final dynamic value = source[key];
      if (value != null && value.toString().isNotEmpty) {
        return value.toString();
      }
    }
    for (final dynamic value in source.values) {
      if (value is Map<String, dynamic>) {
        final String? found = _deepFindString(value, keys);
        if (found != null) return found;
      } else if (value is Map) {
        final String? found = _deepFindString(
          Map<String, dynamic>.from(value),
          keys,
        );
        if (found != null) return found;
      }
    }
    return null;
  }
}
