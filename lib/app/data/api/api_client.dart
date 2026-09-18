import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/data/storage/auth_storage.dart';

class ApiClient {
  ApiClient(this._authStorage) {
    dio.interceptors.add(
      InterceptorsWrapper(onRequest: _onRequest, onError: _onError),
    );
  }

  final AuthStorage _authStorage;

  final Dio dio = Dio(
    BaseOptions(
      baseUrl: ApiEndpoints.baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: const <String, dynamic>{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  final Dio _refreshDio = Dio(
    BaseOptions(
      baseUrl: ApiEndpoints.baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: const <String, dynamic>{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    options.headers['X-Request-Id'] =
        'mobile_${DateTime.now().millisecondsSinceEpoch}';

    final bool skipAuth = options.extra['skipAuth'] == true;
    if (!skipAuth) {
      final String? accessToken = await _authStorage.getAccessToken();
      if (accessToken != null && accessToken.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $accessToken';
      }
    }
    if (kDebugMode) {
      debugPrint('API ${options.method} ${options.uri}');
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final bool canRefresh =
        error.response?.statusCode == 401 &&
        error.requestOptions.extra['skipAuth'] != true &&
        error.requestOptions.extra['retried'] != true;

    if (!canRefresh) {
      handler.next(error);
      return;
    }

    final String? refreshToken = await _authStorage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      handler.next(error);
      return;
    }

    try {
      final Response<dynamic> refreshResponse = await _refreshDio.post<dynamic>(
        ApiEndpoints.refresh,
        data: <String, dynamic>{'refreshToken': refreshToken},
      );
      final Map<String, dynamic> refreshBody = _asMap(refreshResponse.data);
      final Map<String, dynamic> refreshData = _dataMap(refreshBody);
      final String? nextAccessToken = _deepFindString(
        refreshData,
        const <String>['accessToken', 'token'],
      );
      final String? nextRefreshToken = _deepFindString(
        refreshData,
        const <String>['refreshToken'],
      );

      if (nextAccessToken == null) {
        handler.next(error);
        return;
      }

      await _authStorage.updateTokens(
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
      );

      final RequestOptions retryOptions = error.requestOptions;
      retryOptions.extra['retried'] = true;
      retryOptions.headers['Authorization'] = 'Bearer $nextAccessToken';

      final Response<dynamic> retryResponse = await dio.fetch<dynamic>(
        retryOptions,
      );
      handler.resolve(retryResponse);
    } catch (_) {
      handler.next(error);
    }
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
