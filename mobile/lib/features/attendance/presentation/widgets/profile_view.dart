import 'dart:convert';
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../auth/presentation/screens/login_screen.dart';

class ProfileView extends StatelessWidget {
  final Map<String, dynamic> user;

  const ProfileView({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    final fullName = user['fullName'] ?? 'imranalwi';
    final nip = user['nip'] ?? 'EMP008';
    final email = user['email'] ?? 'imranalwi8@gmail.com';
    final phone = user['phone'] ?? '081355904897';
    final role = user['roleName'] ?? 'karyawan';
    final division = user['divisionName'] ?? 'Teknologi Informasi';
    final address = user['address'] ?? 'tamanroja desa batara kecamatan labakkang, Pangkep';
    final avatarUrl = user['avatarUrl'] ?? user['faceEnrolledPhoto'];

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Digital Corporate ID Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.18),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Card Top Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        SizedBox(
                          width: 28,
                          height: 28,
                          child: Image.asset('assets/images/logo.png', fit: BoxFit.contain),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          "PT. FAWWAZ RESKI PERWIRA",
                          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.circle, size: 6, color: Color(0xFF10B981)),
                          SizedBox(width: 4),
                          Text("AKTIF", style: TextStyle(color: Color(0xFF10B981), fontSize: 9.5, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Avatar & Name
                Row(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white24, width: 2),
                      ),
                      child: ClipOval(
                        child: _buildAvatar(avatarUrl, fullName),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            fullName,
                            style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "$nip • $division",
                            style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            role.toUpperCase(),
                            style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 10, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Divider(color: Colors.white12, height: 1),
                const SizedBox(height: 12),

                // Card Footer
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.verified_user_rounded, size: 14, color: Color(0xFF10B981)),
                        SizedBox(width: 4),
                        Text("Terverifikasi Database Resmi Perusahaan", style: TextStyle(color: Colors.white60, fontSize: 10)),
                      ],
                    ),
                    Icon(Icons.qr_code_2_rounded, color: Colors.white54, size: 22),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 2. Keamanan & Biometrik
          Text("Keamanan & Akses Presensi", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
            ),
            child: Column(
              children: [
                _buildSecurityRow(
                  icon: Icons.face_retouching_natural_rounded,
                  iconColor: AppColors.primary,
                  title: "Biometrik Wajah 1:1",
                  status: "Aktif & Terdaftar",
                  statusColor: AppColors.primary,
                ),
                const Divider(height: 18),
                _buildSecurityRow(
                  icon: Icons.my_location_rounded,
                  iconColor: const Color(0xFF0284C7),
                  title: "Geofencing GPS Presisi",
                  status: "Radius 100m Kantor",
                  statusColor: const Color(0xFF0284C7),
                ),
                const Divider(height: 18),
                _buildSecurityRow(
                  icon: Icons.shield_rounded,
                  iconColor: const Color(0xFF7C3AED),
                  title: "Anti-Mock / Fake GPS Defense",
                  status: "Aktif Otomatis",
                  statusColor: const Color(0xFF7C3AED),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 3. Kontak & Info Profil
          Text("Informasi Karyawan", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
            ),
            child: Column(
              children: [
                _buildInfoRow(Icons.email_outlined, "Email Resmi", email),
                const SizedBox(height: 10),
                _buildInfoRow(Icons.phone_outlined, "Nomor Telepon / WA", phone),
                const SizedBox(height: 10),
                _buildInfoRow(Icons.home_outlined, "Alamat Lengkap", address),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // 4. Logout Button
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              side: const BorderSide(color: Color(0xFFFCA5A5)),
              backgroundColor: const Color(0xFFFEF2F2),
            ),
            icon: const Icon(Icons.logout_rounded, size: 18, color: AppColors.danger),
            label: const Text(
              "Keluar dari Akun Karyawan",
              style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700),
            ),
            onPressed: () {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildSecurityRow({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String status,
    required Color statusColor,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: iconColor),
            ),
            const SizedBox(width: 10),
            Text(title, style: AppTypography.bodyMedium.copyWith(fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
        Text(status, style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w700)),
      ],
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppColors.textMuted),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
              Text(value, style: AppTypography.bodyMedium.copyWith(fontSize: 12, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAvatar(String? avatarUrl, String fullName) {
    if (avatarUrl != null && avatarUrl.trim().isNotEmpty) {
      if (avatarUrl.startsWith('data:image')) {
        try {
          final base64Content = avatarUrl.split(',').last;
          final bytes = base64Decode(base64Content);
          return Image.memory(
            bytes,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            errorBuilder: (_, __, ___) => _buildInitials(fullName),
          );
        } catch (_) {}
      } else if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
        return Image.network(
          avatarUrl,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          errorBuilder: (_, __, ___) => _buildInitials(fullName),
        );
      }
    }
    return _buildInitials(fullName);
  }

  Widget _buildInitials(String fullName) {
    final clean = fullName.trim();
    final initials = clean.length >= 2
        ? clean.substring(0, 2).toUpperCase()
        : (clean.isNotEmpty ? clean.toUpperCase() : 'HR');
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.primary,
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
