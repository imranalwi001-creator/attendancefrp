import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';

class OvertimeRequestSheet extends StatefulWidget {
  final String userId;
  final String userName;
  final VoidCallback? onSuccess;

  const OvertimeRequestSheet({
    super.key,
    required this.userId,
    required this.userName,
    this.onSuccess,
  });

  static Future<void> show(BuildContext context, {required String userId, required String userName, VoidCallback? onSuccess}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => OvertimeRequestSheet(userId: userId, userName: userName, onSuccess: onSuccess),
    );
  }

  @override
  State<OvertimeRequestSheet> createState() => _OvertimeRequestSheetState();
}

class _OvertimeRequestSheetState extends State<OvertimeRequestSheet> {
  final _formKey = GlobalKey<FormState>();
  final _taskController = TextEditingController();

  DateTime _overtimeDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 17, minute: 30);
  TimeOfDay _endTime = const TimeOfDay(hour: 20, minute: 30);
  bool _isSubmitting = false;

  double get _durationHours {
    final startMinutes = _startTime.hour * 60 + _startTime.minute;
    final endMinutes = _endTime.hour * 60 + _endTime.minute;
    final diff = endMinutes - startMinutes;
    if (diff <= 0) return 1.0;
    return (diff / 60.0);
  }

  int get _estimatedCompensation {
    const hourlyRate = 25000;
    return (_durationHours * hourlyRate).round();
  }

  @override
  void dispose() {
    _taskController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _overtimeDate,
      firstDate: DateTime.now().subtract(const Duration(days: 3)),
      lastDate: DateTime.now().add(const Duration(days: 14)),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF7C3AED),
            onPrimary: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _overtimeDate = picked);
  }

  Future<void> _pickTime({required bool isStart}) async {
    final initial = isStart ? _startTime : _endTime;
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF7C3AED),
            onPrimary: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  Future<void> _submitOvertime() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    final dateFormatter = DateFormat('yyyy-MM-dd');
    final sTimeStr = "${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}";
    final eTimeStr = "${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}";

    try {
      final res = await ApiService.submitOvertimeRequest(
        userId: widget.userId,
        date: dateFormatter.format(_overtimeDate),
        startTime: sTimeStr,
        endTime: eTimeStr,
        durationHours: _durationHours,
        taskDescription: _taskController.text.trim(),
        rateApplied: 25000,
      );

      if (!mounted) return;
      Navigator.pop(context);
      widget.onSuccess?.call();

      _showSuccessDialog(
        splNumber: res?['data']?['id']?.toString().substring(0, 8).toUpperCase() ?? "SPL-2026-OK",
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Gagal mengirim pengajuan lembur: $e"), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showSuccessDialog({required String splNumber}) {
    final currencyFormat = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

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
                color: Color(0xFFF5F3FF),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified_rounded, color: Color(0xFF7C3AED), size: 48),
            ),
            const SizedBox(height: 16),
            Text(
              "SPL Berhasil Dibuat",
              style: AppTypography.titleMedium.copyWith(fontSize: 18),
            ),
            const SizedBox(height: 8),
            Text(
              "Nomor SPL: #$splNumber\nEstimasi kompensasi: ${currencyFormat.format(_estimatedCompensation)}\nFormulir lembur akan diverifikasi oleh kepala divisi dan masuk ke rekapitulasi slip gaji.",
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted, fontSize: 13),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C3AED),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: const Text("Tutup"),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('EEEE, dd MMMM yyyy');
    final currencyFormat = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
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

              // Title
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Surat Perintah Lembur (SPL)",
                        style: AppTypography.titleMedium.copyWith(fontSize: 18),
                      ),
                      Text(
                        "Kompensasi lembur sesuai Depnaker",
                        style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F3FF),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFDDD6FE)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.timelapse_rounded, size: 14, color: Color(0xFF7C3AED)),
                        SizedBox(width: 4),
                        Text(
                          "SPL Resmi",
                          style: TextStyle(
                            color: Color(0xFF7C3AED),
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // 1. Tanggal Lembur
              Text("Tanggal Lembur", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              InkWell(
                onTap: _pickDate,
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.subSurface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.event_note_rounded, size: 18, color: Color(0xFF7C3AED)),
                      const SizedBox(width: 8),
                      Text(
                        dateFormat.format(_overtimeDate),
                        style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 2. Jam Mulai & Selesai
              Text("Waktu Pelaksanaan", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickTime(isStart: true),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.subSurface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Jam Mulai", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
                            const SizedBox(height: 2),
                            Text(
                              "${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}",
                              style: AppTypography.titleMedium.copyWith(fontSize: 16, fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickTime(isStart: false),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.subSurface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Jam Selesai", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
                            const SizedBox(height: 2),
                            Text(
                              "${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}",
                              style: AppTypography.titleMedium.copyWith(fontSize: 16, fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Kalkulasi Durasi & Upah Lembur Real-Time
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F3FF),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFDDD6FE)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Durasi Terhitung", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                        const SizedBox(height: 2),
                        Text(
                          "${_durationHours.toStringAsFixed(1)} Jam Kerja",
                          style: AppTypography.titleMedium.copyWith(fontSize: 15, fontWeight: FontWeight.w800, color: const Color(0xFF7C3AED)),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text("Estimasi Kompensasi", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                        const SizedBox(height: 2),
                        Text(
                          currencyFormat.format(_estimatedCompensation),
                          style: AppTypography.titleMedium.copyWith(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.primary),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 3. Deskripsi Tugas
              Text("Uraian Tugas / Target Lembur", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _taskController,
                maxLines: 3,
                style: AppTypography.bodyMedium.copyWith(fontSize: 13),
                decoration: InputDecoration(
                  hintText: "Sebutkan pekerjaan spesifik atau target output yang dikerjakan...",
                  hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textDisabled, fontSize: 13),
                  filled: true,
                  fillColor: AppColors.subSurface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF7C3AED), width: 1.5)),
                  contentPadding: const EdgeInsets.all(12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return "Uraian tugas lembur wajib diisi";
                  if (val.trim().length < 5) return "Deskripsi tugas terlalu singkat";
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // CTA Submit Button
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C3AED),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                onPressed: _isSubmitting ? null : _submitOvertime,
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.send_rounded, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            "Ajukan Surat Perintah Lembur",
                            style: AppTypography.buttonText.copyWith(color: Colors.white),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
