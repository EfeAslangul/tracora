package com.tracora.android.data.network

import com.tracora.android.data.model.ApiErrorBody

/** Kotlin counterpart of the web client's `ApiError` (apps/web/src/services/api-client.ts). */
class ApiException(
    val status: Int,
    val body: ApiErrorBody,
) : Exception(body.message)
