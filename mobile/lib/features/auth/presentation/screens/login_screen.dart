import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';
import '../../../attendance/presentation/screens/dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _identifierController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _isPasswordVisible = false;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.login(
        identifier: _identifierController.text.trim(),
        password: _passwordController.text,
      );

      if (res['success'] == true && res['user'] != null) {
        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => AttendanceDashboardScreen(initialUser: res['user']),
          ),
        );
      } else {
        setState(() {
          _errorMessage = res['error'] ?? "Email/NIP atau kata sandi tidak valid.";
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = "Gagal terhubung ke database. Pastikan backend aktif.";
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _fillDemo(String id, String pwd) {
    setState(() {
      _identifierController.text = id;
      _passwordController.text = pwd;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 1. BRAND LOGO & HEADER (Seamless with Background)
                  Center(
                    child: SizedBox(
                      width: 96,
                      height: 96,
                      child: Image.asset(
                        'assets/images/logo.png',
                        fit: BoxFit.contain,
                        filterQuality: FilterQuality.high,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  Text(
                    "PT. FAWWAZ RESKI PERWIRA",
                    textAlign: TextAlign.center,
                    style: AppTypography.titleLarge.copyWith(
                      letterSpacing: 0.3,
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "Sistem Presensi Wajah & GPS Terpadu",
                    textAlign: TextAlign.center,
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 28),

                  // 2. CARD FORM LOGIN
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.03),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            "Masuk Akun Karyawan",
                            style: AppTypography.titleMedium.copyWith(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "Gunakan NIP atau Email resmi perusahaan",
                            style: AppTypography.bodyMedium.copyWith(
                              color: AppColors.textMuted,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Error alert
                          if (_errorMessage != null) ...[
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.dangerBg,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.dangerBorder),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _errorMessage!,
                                      style: AppTypography.labelSmall.copyWith(
                                        color: AppColors.danger,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],

                          // Field NIP / Email
                          Text(
                            "NIP atau Email",
                            style: AppTypography.labelSmall.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _identifierController,
                            keyboardType: TextInputType.emailAddress,
                            style: AppTypography.bodyLarge,
                            decoration: InputDecoration(
                              hintText: "Contoh: EMP001 atau fauzi@hrm.local",
                              hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textDisabled, fontSize: 13),
                              prefixIcon: const Icon(Icons.badge_outlined, size: 20, color: AppColors.textSecondary),
                              filled: true,
                              fillColor: AppColors.subSurface,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: AppColors.border),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: AppColors.border),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                              ),
                            ),
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) {
                                return "NIP atau Email wajib diisi";
                              }
                              return null;
                            },
                          ),

                          const SizedBox(height: 18),

                          // Field Password
                          Text(
                            "Kata Sandi",
                            style: AppTypography.labelSmall.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: !_isPasswordVisible,
                            style: AppTypography.bodyLarge,
                            decoration: InputDecoration(
                              hintText: "Masukkan kata sandi",
                              hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textDisabled, fontSize: 13),
                              prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20, color: AppColors.textSecondary),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _isPasswordVisible ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                                  size: 20,
                                  color: AppColors.textMuted,
                                ),
                                onPressed: () {
                                  setState(() => _isPasswordVisible = !_isPasswordVisible);
                                },
                              ),
                              filled: true,
                              fillColor: AppColors.subSurface,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: AppColors.border),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: AppColors.border),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                              ),
                            ),
                            validator: (val) {
                              if (val == null || val.isEmpty) {
                                return "Kata sandi wajib diisi";
                              }
                              return null;
                            },
                          ),

                          const SizedBox(height: 24),

                          // Button Submit Login
                          ElevatedButton(
                            onPressed: _isLoading ? null : _handleLogin,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 15),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              elevation: 1,
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    height: 22,
                                    width: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      color: Colors.white,
                                    ),
                                  )
                                : Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        "Masuk ke Presensi",
                                        style: AppTypography.titleMedium.copyWith(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      const Icon(Icons.arrow_forward_rounded, size: 18, color: Colors.white),
                                    ],
                                  ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // 3. QUICK 1-CLICK DEMO CHIPS
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.touch_app_outlined, size: 16, color: AppColors.primary),
                            const SizedBox(width: 6),
                            Text(
                              "Pilih Akun Demo dari Database (1-Klik):",
                              style: AppTypography.labelSmall.copyWith(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _buildDemoChip(
                              name: "imranalwi (Aktif)",
                              email: "imranalwi8@gmail.com",
                            ),
                            _buildDemoChip(
                              name: "Ahmad Fauzi (IT)",
                              email: "fauzi@hrm.local",
                            ),
                            _buildDemoChip(
                              name: "Dewi Sartika (MKT)",
                              email: "dewi@hrm.local",
                            ),
                            _buildDemoChip(
                              name: "Budi Prakoso (HR)",
                              email: "admin@hrm.local",
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),
                  Center(
                    child: Text(
                      "Data terverifikasi langsung dengan Sistem Database Terpusat",
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.textDisabled,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDemoChip({required String name, required String email}) {
    return ActionChip(
      avatar: const Icon(Icons.person_pin_circle_rounded, size: 16, color: AppColors.primary),
      label: Text(
        name,
        style: AppTypography.labelSmall.copyWith(
          color: AppColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
      backgroundColor: AppColors.subSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: AppColors.borderSubtle),
      ),
      onPressed: () => _fillDemo(email, "password123"),
    );
  }
}
