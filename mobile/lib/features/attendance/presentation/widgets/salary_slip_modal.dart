import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';

class SalarySlipModal extends StatefulWidget {
  final String userId;
  final String userName;

  const SalarySlipModal({
    super.key,
    required this.userId,
    required this.userName,
  });

  static Future<void> show(BuildContext context, {required String userId, required String userName}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SalarySlipModal(userId: userId, userName: userName),
    );
  }

  @override
  State<SalarySlipModal> createState() => _SalarySlipModalState();
}

class _SalarySlipModalState extends State<SalarySlipModal> {
  bool _isLoading = true;
  Map<String, dynamic>? _slipData;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSlip();
  }

  Future<void> _loadSlip() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final res = await ApiService.fetchSalarySlip(widget.userId);
      if (res != null && res['success'] == true && res['slip'] != null) {
        setState(() => _slipData = res['slip']);
      } else {
        setState(() => _error = "Gagal memuat dokumen slip gaji");
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _fmt(num? val) {
    if (val == null) return "0";
    return NumberFormat('#,###', 'en_US').format(val);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.92),
      padding: const EdgeInsets.only(left: 16, right: 16, top: 14, bottom: 20),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
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
          const SizedBox(height: 12),

          // Header Bar
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
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "SLIP GAJI RESMI",
                        style: AppTypography.titleMedium.copyWith(fontSize: 15, letterSpacing: 0.3),
                      ),
                      Text(
                        "PT. FAWWAZ RESKI PERWIRA",
                        style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 10),
                      ),
                    ],
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textMuted),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const Divider(height: 18),

          // Body: The Official Boxed Slip matching PT. Fawwaz Reski Perwira
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_error!, style: const TextStyle(color: AppColors.danger)),
                            const SizedBox(height: 12),
                            ElevatedButton(
                              onPressed: _loadSlip,
                              child: const Text("Coba Lagi"),
                            ),
                          ],
                        ),
                      )
                    : SingleChildScrollView(
                        physics: const BouncingScrollPhysics(),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _buildOfficialBoxedTemplate(),
                            const SizedBox(height: 14),

                            // Info Footer
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.verified_user_outlined, size: 16, color: Color(0xFF059669)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      "Format resmi disinkronkan langsung dengan database ERP & Payroll PT. Fawwaz Reski Perwira.",
                                      style: AppTypography.labelSmall.copyWith(fontSize: 10, color: const Color(0xFF64748B)),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 14),
                          ],
                        ),
                      ),
          ),

          // Action Buttons: Bagikan & Unduh PDF
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  icon: const Icon(Icons.share_outlined, size: 16, color: AppColors.textPrimary),
                  label: const Text("Bagikan", style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 13)),
                  onPressed: _slipData == null ? null : _handleShareSlip,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                  ),
                  icon: const Icon(Icons.print_outlined, size: 18),
                  label: const Text("Cetak / PDF", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  onPressed: _slipData == null ? null : _handleDownloadPdf,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Official Boxed Layout matching PT. FAWWAZ RESKI PERWIRA template image
  Widget _buildOfficialBoxedTemplate() {
    final employeeName = _slipData?['employee']?['name'] ?? widget.userName;
    final employeeNip = _slipData?['employee']?['nip'] ?? '-';
    final period = _slipData?['period'] ?? 'September 2026';
    final printedDate = _slipData?['printedDate'] ?? '28 September 2026';

    final upah = _slipData?['upah'] ?? 4045050;
    final lembur = _slipData?['lembur'] ?? 0;
    final pesangonLabel = _slipData?['pesangonLabel'] ?? 'Pesangon September';
    final pesangonAmount = _slipData?['pesangonAmount'] ?? 0;
    final grossEarnings = _slipData?['grossEarnings'] ?? (upah + lembur + pesangonAmount);

    final bpjsTk = _slipData?['bpjsTkAmount'] ?? 121351;
    final bpjsKes = _slipData?['bpjsKesAmount'] ?? 40450;
    final alpaDays = _slipData?['alpaDays'] ?? 0;
    final alpaRate = _slipData?['alpaRate'] ?? 155000;
    final alpaAmount = _slipData?['alpaAmount'] ?? 0;
    final totalDeductions = _slipData?['totalDeductions'] ?? (161802 + alpaAmount);

    final netSalary = _slipData?['netSalary'] ?? (grossEarnings - totalDeductions);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. TOP HEADER & METADATA BOX (Black 2px border)
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: Colors.black, width: 2.0),
          ),
          child: Column(
            children: [
              // Company & Title Row
              Container(
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: Colors.black, width: 2.0)),
                ),
                child: Row(
                  children: [
                    // Left: Logo + PT. FAWWAZ RESKI PERWIRA
                    Expanded(
                      flex: 5,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        decoration: const BoxDecoration(
                          border: Border(right: BorderSide(color: Colors.black, width: 2.0)),
                        ),
                        child: Row(
                          children: [
                            Image.asset('assets/images/logo.png', width: 34, height: 34, fit: BoxFit.contain),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    "PT. FAWWAZ RESKI",
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w900,
                                      decoration: TextDecoration.underline,
                                      decorationThickness: 1.5,
                                      color: Colors.black,
                                      letterSpacing: 0.2,
                                    ),
                                  ),
                                  Text(
                                    "PERWIRA",
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w900,
                                      color: Colors.black,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Right: SLIP GAJI KARYAWAN + PERIODE
                    Expanded(
                      flex: 5,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              "SLIP GAJI KARYAWAN",
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: Colors.black,
                                letterSpacing: 0.2,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              "PERIODE : ${period.toUpperCase()}",
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: Colors.black,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Metadata Row: NAMA, ID & DICETAK TANGGAL
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const SizedBox(width: 46, child: Text("NAMA", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Colors.black))),
                              const Text(":", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Colors.black)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(employeeName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Colors.black), overflow: TextOverflow.ellipsis),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              const SizedBox(width: 46, child: Text("ID", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Colors.black))),
                              const Text(":", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Colors.black)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(employeeNip, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Colors.black)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Text(
                      "Dicetak Tanggal  :  $printedDate",
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.black),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),

        // 2. TWO COLUMNS SIDE-BY-SIDE: PENDAPATAN & POTONGAN
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // LEFT COLUMN: PENDAPATAN
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: Colors.black, width: 2.0),
                ),
                child: Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      decoration: const BoxDecoration(
                        border: Border(bottom: BorderSide(color: Colors.black, width: 2.0)),
                      ),
                      child: const Text(
                        "PENDAPATAN :",
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.black),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                      child: Column(
                        children: [
                          _buildPendapatanRow("Upah", "Rp ${_fmt(upah)}"),
                          _buildPendapatanRow("Lembur", lembur > 0 ? "Rp ${_fmt(lembur)}" : ""),
                          _buildPendapatanRow(pesangonLabel, pesangonAmount > 0 ? "Rp ${_fmt(pesangonAmount)}" : ""),
                          _buildPendapatanRow("", ""),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      decoration: const BoxDecoration(
                        border: Border(top: BorderSide(color: Colors.black, width: 2.0)),
                      ),
                      child: _buildPendapatanRow("Total Pendapatan", "Rp ${_fmt(grossEarnings)}", isBold: true),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 6),

            // RIGHT COLUMN: POTONGAN
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: Colors.black, width: 2.0),
                ),
                child: Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      decoration: const BoxDecoration(
                        border: Border(bottom: BorderSide(color: Colors.black, width: 2.0)),
                      ),
                      child: const Text(
                        "POTONGAN :",
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.black),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                      child: Column(
                        children: [
                          _buildPotonganStandardRow("BPJS Ketenagakerjaan 3%", _fmt(bpjsTk)),
                          _buildPotonganStandardRow("BPJS Kesehatan 1%", _fmt(bpjsKes)),
                          _buildPotonganPresensiRow(
                            alpaDays: alpaDays,
                            alpaAmountStr: alpaAmount > 0 ? _fmt(alpaAmount) : "-",
                          ),
                          _buildPotonganEmptyRow(),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      decoration: const BoxDecoration(
                        border: Border(top: BorderSide(color: Colors.black, width: 2.0)),
                      ),
                      child: _buildPotonganStandardRow("Total Potongan", _fmt(totalDeductions), isBold: true),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),

        // 3. BOTTOM RIGHT BOX: JUMLAH GAJI (aligned under POTONGAN)
        Row(
          children: [
            const Spacer(),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: Colors.black, width: 2.0),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      "Jumlah Gaji",
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.black),
                    ),
                    _buildAmountBlock(_fmt(netSalary), isBold: true),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPendapatanRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 82,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                color: Colors.black,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const Text(":", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Colors.black)),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                color: Colors.black,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountBlock(String amountStr, {bool isBold = false}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          ": Rp",
          style: TextStyle(
            fontSize: 9.5,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            color: Colors.black,
          ),
        ),
        const SizedBox(width: 3),
        SizedBox(
          width: 44,
          child: Text(
            amountStr,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
              color: Colors.black,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPotonganStandardRow(String label, String amountStr, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                color: Colors.black,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          _buildAmountBlock(amountStr, isBold: isBold),
        ],
      ),
    );
  }

  Widget _buildPotonganPresensiRow({
    required int alpaDays,
    required String alpaAmountStr,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                const Text(
                  "Presensi / Alpa",
                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: Colors.black),
                ),
                const Spacer(),
                const Text(":", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Colors.black)),
                const SizedBox(width: 4),
                Text(
                  alpaDays > 0 ? "$alpaDays Hari @" : "Hari  @",
                  style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: Colors.black),
                ),
                const SizedBox(width: 2),
              ],
            ),
          ),
          _buildAmountBlock(alpaAmountStr),
        ],
      ),
    );
  }

  Widget _buildPotonganEmptyRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                const Text(
                  "Presensi / Alpa",
                  style: TextStyle(fontSize: 9.5, color: Colors.transparent),
                ),
                const Spacer(),
                const Text(":", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Colors.black)),
                const SizedBox(width: 4),
                const Text(
                  "Hari  @",
                  style: TextStyle(fontSize: 9.5, color: Colors.transparent),
                ),
                const SizedBox(width: 2),
              ],
            ),
          ),
          const SizedBox(width: 65), // matches width of : Rp and 44px amount
        ],
      ),
    );
  }

  Future<void> _handleDownloadPdf() async {
    final printUrl = '${ApiService.baseUrl}/payroll/slip/${widget.userId}/print?autoprint=1';
    final uri = Uri.parse(printUrl);
    try {
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched) {
        await launchUrl(uri);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Membuka dokumen format resmi untuk cetak / simpan PDF..."),
            backgroundColor: Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Gagal membuka dokumen PDF: $e"),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _handleShareSlip() async {
    if (_slipData == null) return;
    final printUrl = '${ApiService.baseUrl}/payroll/slip/${widget.userId}/print';

    final upah = _slipData?['upah'] ?? 4045050;
    final gross = _slipData?['grossEarnings'] ?? 4045050;
    final bpjsTk = _slipData?['bpjsTkAmount'] ?? 121351;
    final bpjsKes = _slipData?['bpjsKesAmount'] ?? 40450;
    final totalDeduct = _slipData?['totalDeductions'] ?? 161802;
    final net = _slipData?['netSalary'] ?? 3883248;

    final shareText = '''
📄 *SLIP GAJI KARYAWAN - PT. FAWWAZ RESKI PERWIRA*
Periode: ${_slipData?['period'] ?? 'September 2026'}
Karyawan: ${_slipData?['employee']?['name'] ?? widget.userName}
ID (NIP): ${_slipData?['employee']?['nip'] ?? '-'}

*PENDAPATAN:*
• Upah: Rp ${_fmt(upah)}
• Lembur: Rp 0
• Total Pendapatan: Rp ${_fmt(gross)}

*POTONGAN:*
• BPJS Ketenagakerjaan 3%: Rp ${_fmt(bpjsTk)}
• BPJS Kesehatan 1%: Rp ${_fmt(bpjsKes)}
• Presensi / Alpa: Rp 0
• Total Potongan: Rp ${_fmt(totalDeduct)}

💵 *JUMLAH GAJI (THP): Rp ${_fmt(net)}*
Dicetak Tanggal: ${_slipData?['printedDate'] ?? '28 September 2026'}

🔗 Verifikasi & Cetak Dokumen Resmi:
$printUrl
'''.trim();

    await Clipboard.setData(ClipboardData(text: shareText));

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Slip Gaji Disalin!",
                        style: AppTypography.titleMedium.copyWith(fontSize: 16),
                      ),
                      Text(
                        "Format resmi slip gaji telah disalin ke clipboard.",
                        style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.subSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                shareText,
                style: const TextStyle(fontSize: 11, fontFamily: 'monospace', height: 1.4),
                maxLines: 7,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF25D366),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.send_rounded, size: 18),
                    label: const Text("Kirim WhatsApp", style: TextStyle(fontWeight: FontWeight.w700)),
                    onPressed: () async {
                      Navigator.pop(ctx);
                      final waUri = Uri.parse("https://wa.me/?text=${Uri.encodeComponent(shareText)}");
                      await launchUrl(waUri, mode: LaunchMode.externalApplication);
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text("Tutup", style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
