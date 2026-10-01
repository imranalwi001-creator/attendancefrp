import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/biometric_security_service.dart';
import '../controllers/attendance_controller.dart';

class BiometricVerificationSheet extends StatefulWidget {
  final AttendanceController controller;

  const BiometricVerificationSheet({super.key, required this.controller});

  @override
  State<BiometricVerificationSheet> createState() => _BiometricVerificationSheetState();
}

class _BiometricVerificationSheetState extends State<BiometricVerificationSheet> with SingleTickerProviderStateMixin {
  late LivenessChallenge _activeChallenge;
  late AnimationController _animController;
  late Animation<double> _laserAnimation;

  Uint8List? _capturedBytes;
  String? _capturedPhotoBase64;
  final ImagePicker _picker = ImagePicker();

  String _currentStepText = "Posisikan wajah Anda tepat di dalam bingkai";
  double _progressValue = 0.0;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _activeChallenge = BiometricSecurityService.getRandomChallenge();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _laserAnimation = Tween<double>(begin: -110, end: 110).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );

    // Auto-trigger front camera after modal presentation transition
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 350), () {
        if (mounted && _capturedBytes == null && !_isLoading) {
          _openCamera();
        }
      });
    });
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  IconData _getChallengeIcon(LivenessChallengeType type) {
    switch (type) {
      case LivenessChallengeType.blink:
        return Icons.remove_red_eye_rounded;
      case LivenessChallengeType.smile:
        return Icons.sentiment_very_satisfied_rounded;
      case LivenessChallengeType.turnHeadLeft:
        return Icons.turn_left_rounded;
      case LivenessChallengeType.turnHeadRight:
        return Icons.turn_right_rounded;
    }
  }

  Future<void> _openCamera() async {
    try {
      final XFile? file = await _picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 1080,
        maxHeight: 1440,
        imageQuality: 85,
      );

      if (file != null) {
        final bytes = await file.readAsBytes();
        final base64Photo = "data:image/jpeg;base64,${base64Encode(bytes)}";
        if (mounted) {
          setState(() {
            _capturedBytes = bytes;
            _capturedPhotoBase64 = base64Photo;
            _errorMessage = null;
          });
          _startBiometricVerification(base64Photo);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = "Akses kamera dibatalkan atau terkendala: $e";
        });
      }
    }
  }

  Future<void> _startBiometricVerification(String? photoBase64) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _progressValue = 0.15;
    });

    try {
      final success = await widget.controller.executeAttendance(
        context,
        activeChallenge: _activeChallenge,
        photo: photoBase64,
        onStepUpdate: (step, progress) {
          if (mounted) {
            setState(() {
              _currentStepText = step;
              _progressValue = progress;
            });
          }
        },
      );

      if (success && mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            content: Row(
              children: [
                const Icon(Icons.verified_user_rounded, color: Colors.white, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Presensi Wajah Berhasil!",
                        style: AppTypography.bodyLarge.copyWith(color: Colors.white, fontWeight: FontWeight.w700),
                      ),
                      Text(
                        "Foto wajah & GPS tersinkronisasi ke server",
                        style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _progressValue = 0.0;
          _errorMessage = e.toString().replaceAll("Exception: ", "");
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Container(
      height: screenHeight * 0.90,
      decoration: const BoxDecoration(
        color: Color(0xFF0B0F19), // Deep immersive camera dark
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        child: Stack(
          alignment: Alignment.center,
          children: [
            // ── 1. BACKGROUND CAMERA VIEWFINDER GRID ────────────────────────
            Positioned.fill(
              child: Container(
                color: const Color(0xFF0B0F19),
                child: CustomPaint(
                  painter: _GridGuidePainter(),
                ),
              ),
            ),

            // ── 2. CENTER BIOMETRIC FACE FRAME ─────────────────────────────
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: 36),
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      // Outer soft glow
                      Container(
                        width: 250,
                        height: 310,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(125),
                          border: Border.all(
                            color: _errorMessage != null
                                ? AppColors.danger
                                : (_isLoading ? const Color(0xFF34D399) : Colors.white.withOpacity(0.4)),
                            width: _isLoading ? 3 : 2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: (_errorMessage != null
                                      ? AppColors.danger
                                      : (_isLoading ? const Color(0xFF34D399) : Colors.white))
                                  .withOpacity(_isLoading ? 0.35 : 0.08),
                              blurRadius: 30,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                      ),

                      // Oval Viewport: Live Photo or Tap to Open Camera
                      ClipRRect(
                        borderRadius: BorderRadius.circular(125),
                        child: GestureDetector(
                          onTap: _isLoading ? null : _openCamera,
                          child: Container(
                            width: 246,
                            height: 306,
                            color: const Color(0xFF111827),
                            child: _capturedBytes != null
                                ? Image.memory(
                                    _capturedBytes!,
                                    fit: BoxFit.cover,
                                    width: 246,
                                    height: 306,
                                  )
                                : Container(
                                    color: const Color(0xFF0F172A),
                                    padding: const EdgeInsets.symmetric(horizontal: 20),
                                    child: Center(
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Container(
                                            width: 72,
                                            height: 72,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: const Color(0xFF059669).withOpacity(0.25),
                                              border: Border.all(color: const Color(0xFF34D399), width: 2),
                                            ),
                                            child: const Icon(
                                              Icons.camera_alt_rounded,
                                              color: Color(0xFF34D399),
                                              size: 36,
                                            ),
                                          ),
                                          const SizedBox(height: 14),
                                          const Text(
                                            "Buka Kamera Wajah",
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            "Ketuk bingkai untuk mengambil foto presensi",
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              color: Colors.white.withOpacity(0.7),
                                              fontSize: 11,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                          ),
                        ),
                      ),

                      // Corner Biometric Brackets
                      SizedBox(
                        width: 270,
                        height: 330,
                        child: CustomPaint(
                          painter: _BiometricBracketPainter(
                            color: _errorMessage != null
                                ? AppColors.danger
                                : (_isLoading ? const Color(0xFF34D399) : Colors.white70),
                          ),
                        ),
                      ),

                      // Animated Laser Scanner Line when scanning
                      if (_isLoading)
                        AnimatedBuilder(
                          animation: _laserAnimation,
                          builder: (context, child) {
                            return Transform.translate(
                              offset: Offset(0, _laserAnimation.value),
                              child: Container(
                                width: 220,
                                height: 3.0,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF34D399),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF34D399).withOpacity(0.9),
                                      blurRadius: 14,
                                      spreadRadius: 3,
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),

                      // Error indicator overlay
                      if (_errorMessage != null)
                        Container(
                          width: 246,
                          height: 306,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(125),
                            color: Colors.black.withOpacity(0.7),
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.error_outline_rounded,
                              size: 64,
                              color: AppColors.danger,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 70),
                ],
              ),
            ),

            // ── 3. TOP HUD & INSTRUCTION OVERLAY ───────────────────────────
            Positioned(
              top: 12,
              left: 16,
              right: 16,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Drag bar
                  Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 10),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Close button
                      InkWell(
                        onTap: () => Navigator.pop(context),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.5),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white24),
                          ),
                          child: const Icon(Icons.close_rounded, color: Colors.white, size: 20),
                        ),
                      ),

                      // Header Title Pill
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.6),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white12),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.camera_alt_outlined, color: Color(0xFF34D399), size: 14),
                            SizedBox(width: 6),
                            Text(
                              "Presensi Wajah",
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                            ),
                          ],
                        ),
                      ),

                      // Location GPS pill
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF064E3B).withOpacity(0.85),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFF059669)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.location_on_rounded, color: Color(0xFF34D399), size: 13),
                            SizedBox(width: 4),
                            Text(
                              "Kantor",
                              style: TextStyle(color: Color(0xFF34D399), fontWeight: FontWeight.w700, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Integrated High-Contrast Instruction Banner
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B).withOpacity(0.92),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: _errorMessage != null
                            ? AppColors.danger
                            : (_isLoading ? const Color(0xFF34D399) : Colors.white24),
                        width: 1.2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.4),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: _errorMessage != null
                                ? AppColors.danger.withOpacity(0.2)
                                : (_isLoading
                                    ? const Color(0xFF34D399).withOpacity(0.2)
                                    : Colors.white.withOpacity(0.12)),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _errorMessage != null
                                ? Icons.warning_amber_rounded
                                : (_isLoading ? Icons.sync_rounded : _getChallengeIcon(_activeChallenge.type)),
                            color: _errorMessage != null
                                ? AppColors.danger
                                : (_isLoading ? const Color(0xFF34D399) : Colors.white),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _errorMessage != null
                                    ? "Verifikasi Gagal"
                                    : (_isLoading ? _currentStepText : _activeChallenge.instruction),
                                style: TextStyle(
                                  color: _errorMessage != null
                                      ? const Color(0xFFFCA5A5)
                                      : (_isLoading ? const Color(0xFF34D399) : Colors.white),
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _errorMessage ?? _activeChallenge.hint,
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.8),
                                  fontSize: 11,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ── 4. BOTTOM FLOATING ACTION CONTROLS ─────────────────────────
            Positioned(
              bottom: 24,
              left: 20,
              right: 20,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_isLoading) ...[
                    // Scanning Progress Info
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            color: Color(0xFF34D399),
                            strokeWidth: 2,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          "Memproses Biometrik ${(_progressValue * 100).toInt()}%",
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: LinearProgressIndicator(
                        value: _progressValue,
                        backgroundColor: Colors.white12,
                        color: const Color(0xFF34D399),
                        minHeight: 5,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ] else if (_errorMessage != null) ...[
                    // Retry Button
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      icon: const Icon(Icons.refresh_rounded, size: 20),
                      label: const Text(
                        "Coba Ambil Foto Ulang",
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                      onPressed: () {
                        setState(() {
                          _errorMessage = null;
                          _capturedBytes = null;
                          _capturedPhotoBase64 = null;
                          _activeChallenge = BiometricSecurityService.getRandomChallenge();
                        });
                        _openCamera();
                      },
                    ),
                  ] else ...[
                    // Primary Action Button
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (_capturedBytes != null) ...[
                          OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: const BorderSide(color: Colors.white38),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            icon: const Icon(Icons.replay_rounded, size: 18),
                            label: const Text("Foto Ulang"),
                            onPressed: _openCamera,
                          ),
                          const SizedBox(width: 12),
                        ],
                        GestureDetector(
                          onTap: _capturedBytes == null
                              ? _openCamera
                              : () => _startBiometricVerification(_capturedPhotoBase64),
                          child: Container(
                            height: 56,
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF059669), Color(0xFF10B981)],
                              ),
                              borderRadius: BorderRadius.circular(28),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF059669).withOpacity(0.4),
                                  blurRadius: 16,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  _capturedBytes == null ? Icons.camera_alt_rounded : Icons.check_circle_rounded,
                                  color: Colors.white,
                                  size: 22,
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  _capturedBytes == null ? "Buka Kamera Depan" : "Kirim Presensi Wajah",
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _capturedBytes == null
                          ? "Ketuk untuk mengambil foto wajah secara otomatis"
                          : "Foto wajah siap diverifikasi dan dikirim ke server",
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── CUSTOM PAINTERS FOR VIEWFINDER ──────────────────────────────────────────

class _GridGuidePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.04)
      ..strokeWidth = 1.0;

    canvas.drawLine(Offset(size.width / 3, 0), Offset(size.width / 3, size.height), paint);
    canvas.drawLine(Offset(size.width * 2 / 3, 0), Offset(size.width * 2 / 3, size.height), paint);
    canvas.drawLine(Offset(0, size.height / 3), Offset(size.width, size.height / 3), paint);
    canvas.drawLine(Offset(0, size.height * 2 / 3), Offset(size.width, size.height * 2 / 3), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _BiometricBracketPainter extends CustomPainter {
  final Color color;

  _BiometricBracketPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 3.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const cornerLength = 24.0;

    // Top-Left Corner Bracket
    canvas.drawLine(const Offset(0, 0), const Offset(cornerLength, 0), paint);
    canvas.drawLine(const Offset(0, 0), const Offset(0, cornerLength), paint);

    // Top-Right Corner Bracket
    canvas.drawLine(Offset(size.width, 0), Offset(size.width - cornerLength, 0), paint);
    canvas.drawLine(Offset(size.width, 0), Offset(size.width, cornerLength), paint);

    // Bottom-Left Corner Bracket
    canvas.drawLine(Offset(0, size.height), Offset(cornerLength, size.height), paint);
    canvas.drawLine(Offset(0, size.height), Offset(0, size.height - cornerLength), paint);

    // Bottom-Right Corner Bracket
    canvas.drawLine(Offset(size.width, size.height), Offset(size.width - cornerLength, size.height), paint);
    canvas.drawLine(Offset(size.width, size.height), Offset(size.width, size.height - cornerLength), paint);
  }

  @override
  bool shouldRepaint(covariant _BiometricBracketPainter oldDelegate) => oldDelegate.color != color;
}
