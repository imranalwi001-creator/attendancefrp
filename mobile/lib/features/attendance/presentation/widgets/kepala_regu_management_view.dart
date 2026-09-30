import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/services/api_service.dart';

/// Kepala Regu Assignment Management — Superadmin/Admin/Korlap only.
/// Lets admin assign each employee (karyawan) to a Kepala Regu.
/// Supports: Individual assignment, Bulk division assignment.
class KepalaReguManagementView extends StatefulWidget {
  final String adminRole;

  const KepalaReguManagementView({super.key, required this.adminRole});

  @override
  State<KepalaReguManagementView> createState() => _KepalaReguManagementViewState();
}

class _KepalaReguManagementViewState extends State<KepalaReguManagementView>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  List<dynamic> _kepalaReguList = [];
  List<dynamic> _employees = [];
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        ApiService.fetchKepalaReguList(),
        ApiService.fetchKepalaReguEmployees(),
      ]);
      if (mounted) {
        setState(() {
          _kepalaReguList = results[0];
          _employees = results[1];
        });
      }
    } catch (_) {}
    finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Header ─────────────────────────────────────────────────────────
        Container(
          color: AppColors.surface,
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Manajemen Kepala Regu', style: AppTypography.titleMedium.copyWith(fontSize: 18, fontWeight: FontWeight.w800)),
                      Text('Penugasan karyawan ke Kepala Regu per divisi', style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
                    ],
                  ),
                  IconButton(icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.primary), onPressed: _load),
                ],
              ),
              const SizedBox(height: 10),
              // Search
              Container(
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: TextField(
                  onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
                  style: const TextStyle(fontSize: 13),
                  decoration: const InputDecoration(
                    hintText: 'Cari karyawan atau divisi...',
                    hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                    prefixIcon: Icon(Icons.search_rounded, size: 18, color: Color(0xFF94A3B8)),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // Tabs
              Container(
                height: 36,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10)),
                child: TabBar(
                  controller: _tabController,
                  dividerColor: Colors.transparent,
                  dividerHeight: 0,
                  indicatorSize: TabBarIndicatorSize.tab,
                  splashFactory: NoSplash.splashFactory,
                  overlayColor: WidgetStateProperty.all(Colors.transparent),
                  indicator: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(7),
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 4, offset: const Offset(0, 1))],
                  ),
                  labelColor: AppColors.textPrimary,
                  unselectedLabelColor: AppColors.textMuted,
                  labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  tabs: const [
                    Tab(height: 30, text: 'Per Kepala Regu'),
                    Tab(height: 30, text: 'Per Karyawan'),
                  ],
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        // ── Content ─────────────────────────────────────────────────────────
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildKepalaReguTab(),
                    _buildEmployeeTab(),
                  ],
                ),
        ),
      ],
    );
  }

  // ── Tab 1: View organized by Kepala Regu ───────────────────────────────────
  Widget _buildKepalaReguTab() {
    final filtered = _kepalaReguList.where((kr) {
      if (_searchQuery.isEmpty) return true;
      final name = (kr['full_name'] ?? '').toString().toLowerCase();
      final div  = (kr['division_name'] ?? '').toString().toLowerCase();
      return name.contains(_searchQuery) || div.contains(_searchQuery);
    }).toList();

    if (filtered.isEmpty) {
      return const Center(child: Text('Belum ada Kepala Regu terdaftar', style: TextStyle(color: Color(0xFF94A3B8))));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: filtered.length,
      itemBuilder: (context, i) {
        final kr = filtered[i];
        final assignedList = (kr['assigned_employees'] as List<dynamic>?) ?? [];
        final divName = kr['division_name'] ?? 'Umum';
        final divId = kr['division_id'];

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 6)],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // KR Header
              Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: const Color(0xFF16A34A).withValues(alpha: 0.12),
                      child: Text(
                        (kr['full_name'] ?? '?')[0].toUpperCase(),
                        style: const TextStyle(color: Color(0xFF16A34A), fontWeight: FontWeight.w800, fontSize: 16),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(kr['full_name'] ?? '-', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: const Color(0xFF16A34A).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
                                child: const Text('KEPALA REGU', style: TextStyle(color: Color(0xFF16A34A), fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                              ),
                              const SizedBox(width: 6),
                              Text(divName, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF16A34A).withValues(alpha: 0.2)),
                      ),
                      child: Text(
                        '${assignedList.length} Karyawan',
                        style: const TextStyle(color: Color(0xFF16A34A), fontSize: 11, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
              // Assigned Employees
              if (assignedList.isNotEmpty) ...[
                const Divider(height: 1, indent: 14, endIndent: 14, color: Color(0xFFF1F5F9)),
                ...assignedList.take(5).map((emp) => Padding(
                  padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
                  child: Row(
                    children: [
                      const Icon(Icons.person_outline_rounded, size: 14, color: Color(0xFF94A3B8)),
                      const SizedBox(width: 6),
                      Expanded(child: Text(emp['fullName'] ?? '-', style: const TextStyle(fontSize: 12, color: Color(0xFF374151)))),
                      Text(emp['divisionName'] ?? '', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                    ],
                  ),
                )),
                if (assignedList.length > 5)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 6, 14, 0),
                    child: Text('+${assignedList.length - 5} karyawan lainnya', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontStyle: FontStyle.italic)),
                  ),
              ] else
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 6, 14, 0),
                  child: Text('Belum ada karyawan ditugaskan', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontStyle: FontStyle.italic)),
                ),

              // Bulk Assign Button
              if (divId != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.group_add_rounded, size: 14),
                    label: Text('Tugaskan Semua Karyawan Divisi $divName'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF16A34A),
                      side: const BorderSide(color: Color(0xFF16A34A)),
                      textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      minimumSize: const Size(0, 32),
                    ),
                    onPressed: () => _bulkAssign(kr['id'], divId, kr['full_name'] ?? 'Kepala Regu', divName),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  // ── Tab 2: View organized by Employee ──────────────────────────────────────
  Widget _buildEmployeeTab() {
    final filtered = _employees.where((emp) {
      if (_searchQuery.isEmpty) return true;
      final name = (emp['full_name'] ?? '').toString().toLowerCase();
      final div  = (emp['division_name'] ?? '').toString().toLowerCase();
      return name.contains(_searchQuery) || div.contains(_searchQuery);
    }).toList();

    if (filtered.isEmpty) {
      return const Center(child: Text('Tidak ada karyawan ditemukan', style: TextStyle(color: Color(0xFF94A3B8))));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: filtered.length,
      itemBuilder: (context, i) {
        final emp = filtered[i];
        final currentKR = emp['kepala_regu_name'] ?? 'Belum ditugaskan';
        final hasKR     = emp['kepala_regu_id'] != null;

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: hasKR ? AppColors.border : const Color(0xFFFED7AA)),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: const Color(0xFF2563EB).withValues(alpha: 0.1),
                child: Text((emp['full_name'] ?? '?')[0].toUpperCase(),
                  style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w800, fontSize: 14)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(emp['full_name'] ?? '-', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                    Text(emp['division_name'] ?? '', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(hasKR ? Icons.check_circle_rounded : Icons.warning_amber_rounded, size: 11, color: hasKR ? const Color(0xFF059669) : const Color(0xFFD97706)),
                        const SizedBox(width: 4),
                        Expanded(child: Text(currentKR, style: TextStyle(fontSize: 10, color: hasKR ? const Color(0xFF059669) : const Color(0xFFD97706), fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                      ],
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_rounded, size: 18, color: AppColors.primary),
                onPressed: () => _showAssignDialog(emp),
                tooltip: 'Ganti Kepala Regu',
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _bulkAssign(String krId, String divId, String krName, String divName) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Konfirmasi Penugasan Massal', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        content: Text('Tugaskan semua karyawan divisi "$divName" ke Kepala Regu $krName?\n\nIni akan menimpa penugasan yang sudah ada.', style: const TextStyle(fontSize: 13)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF059669)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Tugaskan', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final res = await ApiService.bulkAssignKepalaRegu(kepalaReguId: krId, divisionId: divId);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(res['message'] ?? (res['success'] == true ? 'Berhasil!' : 'Gagal: ${res['error']}')),
        backgroundColor: res['success'] == true ? const Color(0xFF059669) : const Color(0xFFDC2626),
      ));
      if (res['success'] == true) _load();
    }
  }

  Future<void> _showAssignDialog(Map<String, dynamic> emp) async {
    String? selectedKrId = emp['kepala_regu_id'];

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Pilih Kepala Regu untuk', style: AppTypography.labelSmall.copyWith(color: AppColors.textMuted)),
              const SizedBox(height: 2),
              Text(emp['full_name'] ?? '-', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              Text(emp['division_name'] ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              const SizedBox(height: 16),
              // None option
              _krOption(ctx, null, 'Tidak ada (hapus penugasan)', selectedKrId, (v) => setModalState(() => selectedKrId = v)),
              ..._kepalaReguList.map((kr) => _krOption(ctx, kr['id'], '${kr['full_name']} (${kr['division_name'] ?? '-'})', selectedKrId, (v) => setModalState(() => selectedKrId = v))),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () async {
                    Navigator.pop(ctx);
                    final res = await ApiService.assignKepalaRegu(employeeId: emp['id'], kepalaReguId: selectedKrId);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(res['message'] ?? (res['success'] == true ? 'Berhasil!' : 'Gagal')),
                        backgroundColor: res['success'] == true ? const Color(0xFF059669) : const Color(0xFFDC2626),
                      ));
                      if (res['success'] == true) _load();
                    }
                  },
                  child: const Text('Simpan Penugasan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _krOption(BuildContext ctx, String? id, String label, String? selected, Function(String?) onSelect) {
    final isSelected = selected == id;
    return InkWell(
      onTap: () => onSelect(id),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        margin: const EdgeInsets.only(bottom: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withValues(alpha: 0.06) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isSelected ? AppColors.primary : const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Icon(isSelected ? Icons.radio_button_checked : Icons.radio_button_off, size: 18, color: isSelected ? AppColors.primary : const Color(0xFF94A3B8)),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: TextStyle(fontSize: 13, fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400, color: isSelected ? AppColors.primary : const Color(0xFF374151)))),
          ],
        ),
      ),
    );
  }
}
