package com.tracora.android.data.auth

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.tasks.await

/**
 * Wraps Firebase Auth (email/password only for v1). Mirrors the lazy, null-safe pattern in
 * apps/web/src/services/firebase.ts: nothing crashes when `google-services.json` is still the
 * placeholder — [isConfigured] just comes back false and callers treat the user as signed out.
 */
class FirebaseAuthService {
    private val auth: FirebaseAuth? = runCatching { FirebaseAuth.getInstance() }.getOrNull()

    val isConfigured: Boolean get() = auth != null

    val currentUser: FirebaseUser? get() = auth?.currentUser

    suspend fun signIn(email: String, password: String) {
        requireAuth().signInWithEmailAndPassword(email, password).await()
    }

    suspend fun createAccount(email: String, password: String) {
        requireAuth().createUserWithEmailAndPassword(email, password).await()
    }

    fun signOut() {
        auth?.signOut()
    }

    suspend fun deleteAccount() {
        requireAuth().currentUser?.delete()?.await()
    }

    suspend fun currentIdToken(): String? {
        val user = auth?.currentUser ?: return null
        return runCatching { user.getIdToken(false).await()?.token }.getOrNull()
    }

    private fun requireAuth(): FirebaseAuth =
        auth ?: throw IllegalStateException("Firebase henüz yapılandırılmadı. apps/android/README.md dosyasına bakın.")
}
