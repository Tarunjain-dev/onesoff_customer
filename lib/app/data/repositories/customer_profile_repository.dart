import 'package:dio/dio.dart';
import 'package:onesoff_customer/app/data/api/api_client.dart';
import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/data/models/customer_profile.dart';

class CustomerProfileRepository {
  CustomerProfileRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<CustomerProfile> getProfile() async {
    final Response<dynamic> response = await _apiClient.dio.get<dynamic>(
      ApiEndpoints.customerProfile,
    );
    return CustomerProfile.fromJson(_extractData(response.data));
  }

  Future<CustomerProfile> updateProfile(Map<String, dynamic> payload) async {
    final Response<dynamic> response = await _apiClient.dio.patch<dynamic>(
      ApiEndpoints.customerProfile,
      data: payload,
    );
    return CustomerProfile.fromJson(_extractData(response.data));
  }

  Map<String, dynamic> _extractData(dynamic response) {
    if (response is Map<String, dynamic>) {
      final dynamic data = response['data'];
      if (data is Map<String, dynamic>) return data;
      if (data is Map) return Map<String, dynamic>.from(data);
      return response;
    }
    if (response is Map) return Map<String, dynamic>.from(response);
    return <String, dynamic>{};
  }
}
