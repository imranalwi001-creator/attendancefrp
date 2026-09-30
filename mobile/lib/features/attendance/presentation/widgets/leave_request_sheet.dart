import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';

class LeaveRequestSheet extends StatefulWidget {
  final String userId;
  final String userName;
  final int? initialRemainingQuota;
  final VoidCallback? onSuccess;

  const LeaveRequestSheet({
    super.key,
    required this.userId,
    required this.userName,
    this.initialRemainingQuota,
    this.onSuccess,
  });

  static Future<void> show(BuildContext context, {required String userId, required String userName, int? initialRemainingQuota, VoidCallback? onSuccess}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => LeaveRequestSheet(userId: userId, userName: userName, initialRemainingQuota: initialRemainingQuota, onSuccess: onSuccess),
    );
  }

  @override
  State<LeaveRequestSheet> createState() => _LeaveRequestSheetState();
}

class _LeaveRequestSheetState extends State<LeaveRequestSheet> {
  final _formKey = GlobalKey<FormState>();
  final _reasonController = TextEditingController();

  String _selectedLeaveType = 'cuti_tahunan';
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));
  DateTime _endDate = DateTime.now().add(const Duration(days: 2));
  bool _hasAttachment = false;
  String _attachmentName = "";
  Uint8List? _attachmentBytes;
  int _remainingQuota = 12;
  bool _isSubmitting = false;

  final Map<String, String> _leaveTypeLabels = {
    'cuti_tahunan': 'Cuti Tahunan (Reguler)',
    'sakit': 'Sakit (Disertai Surat Dokter)',
    'izin': 'Izin Keperluan Pribadi / Mendesak',
    'tugas_luar': 'Tugas / Dinas Luar Kantor',
    'cuti_khusus': 'Cuti Khusus (Menikah / Duka / Lahiran)',
  };

  @override
  void initState() {
    super.initState();
    if (widget.initialRemainingQuota != null) {
      _remainingQuota = widget.initialRemainingQuota!;
    }
    _loadQuota();
  }

  Future<void> _loadQuota() async {
    try {
      final res = await ApiService.fetchLeaveRequests(widget.userId);
      if (mounted && res.isNotEmpty) {
        final quota = (res[0]['annual_leave_quota'] as num?)?.toInt() ?? 12;
        final used = (res[0]['used_leave_days'] as num?)?.toInt() ?? 0;
        setState(() => _remainingQuota = (quota - used).clamp(0, 99));
      }
    } catch (_) {}
  }

  Future<void> _pickAttachment(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final XFile? file = await picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (file != null) {
        final bytes = await file.readAsBytes();
        setState(() {
          _hasAttachment = true;
          _attachmentBytes = bytes;
          _attachmentName = file.name.isNotEmpty ? file.name : "bukti_${DateTime.now().millisecondsSinceEpoch}.jpg";
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Gagal mengambil foto dokumen: $e"), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _showAttachmentPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Material(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        clipBehavior: Clip.antiAlias,
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.document_scanner_rounded, color: AppColors.primary, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Lampirkan Bukti / Surat Dokter", style: AppTypography.titleMedium.copyWith(fontSize: 15)),
                        Text("Karyawan wajib melampirkan foto dokumen resmi", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 11)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Material(
                color: Colors.transparent,
                child: ListTile(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  tileColor: AppColors.subSurface,
                  leading: const Icon(Icons.camera_alt_rounded, color: AppColors.primary),
                  title: const Text("Ambil Foto Sekarang (Kamera)", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  subtitle: const Text("Buka kamera perangkat untuk memotret surat fisik", style: TextStyle(fontSize: 11)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _pickAttachment(ImageSource.camera);
                  },
                ),
              ),
              const SizedBox(height: 8),
              Material(
                color: Colors.transparent,
                child: ListTile(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  tileColor: AppColors.subSurface,
                  leading: const Icon(Icons.photo_library_rounded, color: Color(0xFF0284C7)),
                  title: const Text("Pilih dari Galeri / Berkas", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  subtitle: const Text("Pilih gambar dokumen yang sudah tersimpan", style: TextStyle(fontSize: 11)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _pickAttachment(ImageSource.gallery);
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  int get _calculatedDays {
    final diff = _endDate.difference(_startDate).inDays;
    return diff >= 0 ? diff + 1 : 1;
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool isStart}) async {
    final initial = isStart ? _startDate : _endDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now().add(const Duration(days: 90)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: Colors.white,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate.isBefore(_startDate)) {
            _endDate = _startDate;
          }
        } else {
          _endDate = picked;
          if (_endDate.isBefore(_startDate)) {
            _startDate = _endDate;
          }
        }
      });
    }
  }

  Future<void> _submitLeave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    final formatter = DateFormat('yyyy-MM-dd');

    try {
      final res = await ApiService.submitLeaveRequest(
        userId: widget.userId,
        leaveType: _selectedLeaveType,
        startDate: formatter.format(_startDate),
        endDate: formatter.format(_endDate),
        totalDays: _calculatedDays,
        reason: _reasonController.text.trim(),
        attachmentUrl: _hasAttachment ? "https://hrm.local/uploads/docs/$_attachmentName" : null,
      );

      if (!mounted) return;
      Navigator.pop(context);

      widget.onSuccess?.call();

      _showSuccessDialog(
        ticketId: res?['data']?['id']?.toString().substring(0, 8).toUpperCase() ?? "CUTI-2026-OK",
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Gagal mengirim pengajuan: $e"), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showSuccessDialog({required String ticketId}) {
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
                color: Color(0xFFF0FDF4),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 48),
            ),
            const SizedBox(height: 16),
            Text(
              "Pengajuan Berhasil Dikirim",
              style: AppTypography.titleMedium.copyWith(fontSize: 18),
            ),
            const SizedBox(height: 8),
            Text(
              "Nomor Dokumen: #$ticketId\nPengajuan Anda telah berhasil dikirim dan sedang menunggu verifikasi atasan.",
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textMuted, fontSize: 13),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: const Text("Selesai"),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy');

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
              // Drag Indicator
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

              // Title & Quota Badge
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Formulir Izin / Cuti",
                        style: AppTypography.titleMedium.copyWith(fontSize: 18),
                      ),
                      Text(
                        "Persetujuan instan terhubung ke HRD",
                        style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0F9FF),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFBAE6FD)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.beach_access_rounded, size: 14, color: Color(0xFF0284C7)),
                        const SizedBox(width: 4),
                        Text(
                          "Sisa: $_remainingQuota Hari",
                          style: AppTypography.labelSmall.copyWith(
                            color: const Color(0xFF0284C7),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // 1. Tipe Izin / Cuti
              Text("Jenis Pengajuan", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: AppColors.subSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedLeaveType,
                    isExpanded: true,
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.textSecondary),
                    items: _leaveTypeLabels.entries.map((e) {
                      return DropdownMenuItem(
                        value: e.key,
                        child: Text(e.value, style: AppTypography.bodyMedium.copyWith(fontSize: 13)),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedLeaveType = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 2. Rentang Tanggal
              Text("Periode Waktu", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickDate(isStart: true),
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
                            Text("Mulai", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.primary),
                                const SizedBox(width: 6),
                                Text(dateFormat.format(_startDate), style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickDate(isStart: false),
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
                            Text("Sampai", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10)),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.primary),
                                const SizedBox(width: 6),
                                Text(dateFormat.format(_endDate), style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Total Days Calculated
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.subSurface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("Total Durasi Pengajuan:", style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                    Text("$_calculatedDays Hari Kerja", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w800, color: AppColors.primary)),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 3. Alasan / Keterangan
              Text("Alasan & Keterangan Pengajuan", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _reasonController,
                maxLines: 3,
                style: AppTypography.bodyMedium.copyWith(fontSize: 13),
                decoration: InputDecoration(
                  hintText: "Tuliskan keterangan detail keperluan izin/cuti Anda...",
                  hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textDisabled, fontSize: 13),
                  filled: true,
                  fillColor: AppColors.subSurface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                  contentPadding: const EdgeInsets.all(12),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return "Alasan pengajuan wajib diisi";
                  if (val.trim().length < 5) return "Keterangan terlalu singkat";
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // 4. Lampiran Bukti / Surat Dokter
              Text("Lampiran Bukti / Surat Dokter (Opsional)", style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              if (_hasAttachment && _attachmentBytes != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary, width: 1.2),
                  ),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.memory(
                          _attachmentBytes!,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.check_circle_rounded, size: 14, color: AppColors.primary),
                                const SizedBox(width: 4),
                                Text(
                                  "Foto Bukti Terlampir",
                                  style: AppTypography.labelSmall.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _attachmentName,
                              style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.camera_alt_outlined, size: 18, color: AppColors.textSecondary),
                        tooltip: "Ganti Foto",
                        onPressed: _showAttachmentPicker,
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.danger),
                        tooltip: "Hapus",
                        onPressed: () {
                          setState(() {
                            _hasAttachment = false;
                            _attachmentBytes = null;
                            _attachmentName = "";
                          });
                        },
                      ),
                    ],
                  ),
                )
              else
                InkWell(
                  onTap: _showAttachmentPicker,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.subSurface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.add_a_photo_outlined,
                            color: Color(0xFF0284C7),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "Ambil Foto Surat / Lampiran Bukti",
                                style: AppTypography.labelSmall.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              Text(
                                "Ketuk untuk membuka kamera atau pilih berkas",
                                style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textDisabled),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 24),

              // CTA Submit Button
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                onPressed: _isSubmitting ? null : _submitLeave,
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
                            "Kirim Permohonan Izin / Cuti",
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
