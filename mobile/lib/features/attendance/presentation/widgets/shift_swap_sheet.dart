import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';

class ShiftSwapSheet extends StatefulWidget {
  final String userId;
  final String userName;
  final VoidCallback? onSuccess;

  const ShiftSwapSheet({
    super.key,
    required this.userId,
    required this.userName,
    this.onSuccess,
  });

  static Future<void> show(
    BuildContext context, {
    required String userId,
    required String userName,
    VoidCallback? onSuccess,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ShiftSwapSheet(userId: userId, userName: userName, onSuccess: onSuccess),
    );
  }

  @override
  State<ShiftSwapSheet> createState() => _ShiftSwapSheetState();
}

class _ShiftSwapSheetState extends State<ShiftSwapSheet> {
  final _formKey = GlobalKey<FormState>();
  final _reasonController = TextEditingController();

  DateTime _swapDate = DateTime.now().add(const Duration(days: 1));
  String _originalShift = "Shift 1 (07:30 - 15:30)";
  String _targetCategory = "Izin Mendesak / Penggantian Pos";
  bool _isSubmitting = false;

  bool _isLoadingRecommendations = false;
  List<dynamic> _smartCandidates = [];

  final List<String> _shiftOptions = [
    "Shift 1 (07:30 - 15:30)",
    "Shift 2 (15:30 - 22:30)",
    "Shift 3 (22:30 - 07:30)",
    "Reguler (08:00 - 17:00)",
  ];

  final List<String> _categoryOptions = [
    "Izin Mendesak / Penggantian Pos",
    "Sakit Terjadwal / Periksa Medis",
    "Tukar Piket Regu Lapangan",
    "Kebutuhan Operasional Khusus",
  ];

  @override
  void initState() {
    super.initState();
    _fetchSmartCandidates();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _fetchSmartCandidates() async {
    setState(() => _isLoadingRecommendations = true);
    final dateStr = DateFormat('yyyy-MM-dd').format(_swapDate);
    try {
      final list = await ApiService.fetchSmartCandidates(
        requesterId: widget.userId,
        swapDate: dateStr,
        originalShift: _originalShift,
      );
      if (mounted) {
        setState(() {
          _smartCandidates = list;
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _isLoadingRecommendations = false);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _swapDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 60)),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
            primary: Color(0xFFD97706),
            onPrimary: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() => _swapDate = picked);
      _fetchSmartCandidates();
    }
  }

  Future<void> _submitSwap() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    final dateStr = DateFormat('yyyy-MM-dd').format(_swapDate);

    try {
      final res = await ApiService.submitShiftSwap(
        requesterId: widget.userId,
        swapDate: dateStr,
        originalShift: _originalShift,
        targetShift: _targetCategory,
        reason: _reasonController.text.trim(),
      );

      if (!mounted) return;
      if (res != null && res['success'] == false) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['error'] ?? "Gagal mengirim permohonan"),
            backgroundColor: AppColors.danger,
          ),
        );
        return;
      }

      Navigator.pop(context);
      widget.onSuccess?.call();

      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Color(0xFFFEF3C7),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.shield_outlined, color: Color(0xFFD97706), size: 44),
              ),
              const SizedBox(height: 16),
              Text(
                "Pengajuan Berhasil Dikirim",
                style: AppTypography.titleMedium.copyWith(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                "Permohonan pengisian pos dinas Anda untuk tanggal $dateStr telah diteruskan ke Kepala Regu (Danru) untuk ditelaah dan diteruskan ke Korlap untuk penetapan personil pengganti.",
                textAlign: TextAlign.center,
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted, fontSize: 12.5),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "Alur Verifikasi Bertingkat:",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11.5, color: Color(0xFF334155)),
                    ),
                    const SizedBox(height: 6),
                    _buildStepRow(1, "Kepala Regu (Danru)", "Menelaah & memberikan rekomendasi pengganti"),
                    const SizedBox(height: 4),
                    _buildStepRow(2, "Koordinator Lapangan (Korlap)", "Penentu akhir & pengesahan personil pengganti"),
                    const SizedBox(height: 4),
                    _buildStepRow(3, "Notifikasi Otomatis", "Info persetujuan ke Anda & penugasan ke rekan pengganti"),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    elevation: 0,
                  ),
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text("Mengerti & Pantau Status", style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Gagal mengirim permohonan: $e"), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Widget _buildStepRow(int number, String title, String desc) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 8,
          backgroundColor: const Color(0xFFD97706),
          child: Text("$number", style: const TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.bold)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
              Text(desc, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('EEEE, dd MMMM yyyy');

    return Material(
      color: AppColors.surface,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: Container(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.borderSubtle,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Header Title
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Pengajuan Pengganti Pos / Dinas",
                          style: AppTypography.titleMedium.copyWith(fontSize: 17, fontWeight: FontWeight.w800),
                        ),
                        Text(
                          "Pencarian & penetapan oleh Danru & Korlap",
                          style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20, color: AppColors.textSecondary),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const Divider(height: 24),

                // Smart Assistant Info Card
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.psychology_rounded, color: Color(0xFFD97706), size: 22),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              "Sistem Rekomendasi Cerdas Otomatis",
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF92400E),
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              "Anda tidak perlu memilih pengganti sendiri. Sistem akan menganalisis kecocokan personil yang jadwalnya kosong, beban kerja merata, dan merekomendasikannya ke Kepala Regu & Korlap.",
                              style: AppTypography.labelSmall.copyWith(
                                color: const Color(0xFFB45309),
                                fontSize: 11,
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 1. Tanggal Pos / Dinas
                Text(
                  "Tanggal Kekosongan Dinas *",
                  style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700, fontSize: 12),
                ),
                const SizedBox(height: 6),
                InkWell(
                  onTap: _pickDate,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.subSurface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.calendar_month_rounded, size: 18, color: Color(0xFFD97706)),
                            const SizedBox(width: 10),
                            Text(
                              dateFormat.format(_swapDate),
                              style: AppTypography.bodyMedium.copyWith(fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                        const Icon(Icons.arrow_drop_down, color: AppColors.textMuted),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // 2. Shift yang Ditinggalkan
                Text(
                  "Shift yang Anda Tinggalkan *",
                  style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700, fontSize: 12),
                ),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: _originalShift,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    filled: true,
                    fillColor: AppColors.subSurface,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                  ),
                  items: _shiftOptions.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 13)))).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setState(() => _originalShift = val);
                      _fetchSmartCandidates();
                    }
                  },
                ),
                const SizedBox(height: 16),

                // 3. Kategori / Keperluan Pengisian Pos
                Text(
                  "Kategori Pengisian Pos Dinas *",
                  style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700, fontSize: 12),
                ),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: _targetCategory,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    filled: true,
                    fillColor: AppColors.subSurface,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                  ),
                  items: _categoryOptions.map((c) => DropdownMenuItem(value: c, child: Text(c, style: const TextStyle(fontSize: 13)))).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _targetCategory = val);
                  },
                ),
                const SizedBox(height: 16),

                // 4. Live Smart Candidates Preview Card
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.auto_awesome, color: Color(0xFF0284C7), size: 16),
                              const SizedBox(width: 6),
                              const Text(
                                "Kandidat Terdeteksi Siap (Preview Sistem):",
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11.5, color: Color(0xFF0F172A)),
                              ),
                            ],
                          ),
                          if (_isLoadingRecommendations)
                            const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0284C7))),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (_smartCandidates.isEmpty && !_isLoadingRecommendations)
                        Text(
                          "Sistem sedang menyiapkan pemetaan personil untuk Kepala Regu & Korlap.",
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontStyle: FontStyle.italic),
                        )
                      else ...[
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: _smartCandidates.take(3).map((c) {
                            final name = c['name']?.toString() ?? 'Personil';
                            final score = c['score']?.toString() ?? '90';
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.person_pin_circle_rounded, size: 13, color: Color(0xFF059669)),
                                  const SizedBox(width: 4),
                                  Text(name, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                  const SizedBox(width: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                    decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(4)),
                                    child: Text("$score%", style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF15803D))),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          "* Kepala Regu & Korlap akan meninjau daftar lengkap kandidat ini untuk penetapan resmi.",
                          style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 5. Alasan / Keterangan
                Text(
                  "Alasan / Keterangan Pengajuan *",
                  style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700, fontSize: 12),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _reasonController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: "Contoh: Ada keperluan keluarga mendesak / sakit / pengalihan pos jaga...",
                    hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textDisabled, fontSize: 12),
                    filled: true,
                    fillColor: AppColors.subSurface,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty) ? "Alasan wajib diisi" : null,
                ),
                const SizedBox(height: 24),

                // Submit Button
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  icon: _isSubmitting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.send_rounded, size: 18),
                  label: Text(
                    _isSubmitting ? "Mengirim Pengajuan..." : "Kirim Pengajuan ke Danru & Korlap",
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  onPressed: _isSubmitting ? null : _submitSwap,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
