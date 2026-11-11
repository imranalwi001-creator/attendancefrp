// ═══════════════════════════════════════════════════════════════════════════════
// PT. FAWWAZ RESKI PERWIRA (FRP) — LEAVE LEDGER & OVERTIME ARREARS (N-1) SYNC
// Covers 3 Official Groups:
//   1. RUMAH TANGGA (FR07001 - FR07033): Quota 12 Days (Mar 2026 - Feb 2027)
//   2. SHIPMENT     (FR07034 - FR07080): Quota  9 Days (Apr 2026 - Dec 2026)
//   3. KARYAWAN TETAP (Aslam, Samsi, Takdir): Quota 12 Days (Mar 2026 - Feb 2027)
// ═══════════════════════════════════════════════════════════════════════════════

const LEADERSHIP_NIPS = new Set(['FRP07065', 'FRP07046']);
const LEADERSHIP_EMAILS = new Set([
  'aslamfaisal10okt@gmail.com',
  'abangelsamsi@gmail.com',
  'mtakdir46@gmail.com',
]);

const DAY_SHIFT_NIPS = new Set([
  'FR07001', 'FR07002', 'FR07003', 'FR07004', 'FR07005',
  'FR07007',
  'FR07013', 'FR07014', 'FR07015', 'FR07016', 'FR07017', 'FR07018', 'FR07019', 'FR07020', 'FR07021', 'FR07022',
  'FR07028',
  'FR07042', 'FR07044', 'FR07046',
]);

function normalizeNip(nip) {
  return String(nip || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function classifyFrpGroup(profile) {
  if (!profile) return 'OTHER';
  const email = String(profile.email || '').trim().toLowerCase();
  const normNip = normalizeNip(profile.nip);

  if (LEADERSHIP_EMAILS.has(email) || LEADERSHIP_NIPS.has(normNip)) {
    return 'KARYAWAN TETAP';
  }
  if (normNip === 'FR07066' && email.includes('samsi')) {
    return 'KARYAWAN TETAP';
  }

  const m = normNip.match(/^FR(?:07)?(\d{2,3})$/);
  if (m) {
    const seq = parseInt(m[1], 10);
    if (seq >= 1 && seq <= 33) return 'RUMAH TANGGA';
    if (seq >= 34 && seq <= 80) return 'SHIPMENT';
  }
  return 'OTHER';
}

function isOfficialFrpEmployee(profile) {
  if (!profile) return false;
  const email = String(profile.email || '').trim().toLowerCase();
  if (email.includes('simulasi') || email.includes('demo') || email.includes('test')) return false;
  const grp = classifyFrpGroup(profile);
  return grp !== 'OTHER';
}

function extractFrpSequence(nip) {
  const m = normalizeNip(nip).match(/^FR(?:P)?(?:07)?(\d{2,3})$/);
  return m ? parseInt(m[1], 10) : 9999;
}

// Baseline resmi dari dokumen Excel Pimpinan:
// 1. REKAP CUTI RUMAH TANGGA DAN WISMA TAHUN KE 2 (Mar 2026 - Sep 2026)
const RUMAH_TANGGA_BASELINE = {
  FR07001: { '2026-04': 2, '2026-07': 1, '2026-09': 2 },
  FR07002: {},
  FR07003: { '2026-04': 2 },
  FR07004: { '2026-04': 1, '2026-07': 4 },
  FR07005: { '2026-06': 1, '2026-07': 1 },
  FR07006: { '2026-05': 2, '2026-08': 1 },
  FR07007: { '2026-03': 2, '2026-04': 2, '2026-07': 1, '2026-09': 1 },
  FR07008: { '2026-03': 4 },
  FR07009: {},
  FR07010: { '2026-03': 2, '2026-09': 1 },
  FR07011: {},
  FR07012: { '2026-04': 1, '2026-06': 1, '2026-08': 2 },
  FR07013: { '2026-04': 3, '2026-07': 1 },
  FR07014: { '2026-04': 1 },
  FR07015: { '2026-04': 2, '2026-05': 1, '2026-08': 1 },
  FR07016: {},
  FR07017: { '2026-04': 1, '2026-09': 1 },
  FR07018: { '2026-06': 2 },
  FR07019: { '2026-05': 1, '2026-09': 1 },
  FR07020: {},
  FR07021: { '2026-07': 2 },
  FR07022: { '2026-06': 1, '2026-07': 1 },
  FR07023: { '2026-08': 4 },
  FR07024: {},
  FR07025: { '2026-03': 3, '2026-08': 5 },
  FR07026: { '2026-07': 1 },
  FR07027: {},
  FR07028: { '2026-05': 1, '2026-06': 1, '2026-07': 1 },
  FR07029: { '2026-03': 2 },
  FR07030: { '2026-09': 1 },
  FR07031: { '2026-04': 2, '2026-07': 1, '2026-08': 1 },
  FR07032: {},
  FR07033: { '2026-03': 1, '2026-06': 2 },
};

// 2. REKAPAN CUTI ADENDDUM SHIPMENT PT FAWWAZ RESKI PERWIRA (Apr 2026 - Sep 2026)
const SHIPMENT_BASELINE = {
  FR07034: { '2026-07': 1 },
  FR07035: { '2026-04': 5, '2026-07': 1, '2026-09': 1 },
  FR07036: { '2026-04': 4, '2026-06': 1, '2026-07': 1, '2026-08': 1 },
  FR07037: { '2026-06': 1, '2026-08': 1, '2026-09': 2 },
  FR07038: { '2026-04': 2 },
  FR07039: { '2026-05': 3, '2026-06': 1, '2026-09': 2 },
  FR07040: { '2026-04': 2, '2026-06': 1, '2026-08': 2, '2026-09': 1 },
  FR07041: { '2026-04': 1, '2026-06': 1, '2026-07': 1, '2026-08': 2 },
  FR07042: { '2026-04': 1, '2026-06': 1, '2026-08': 1 },
  FR07043: { '2026-04': 2, '2026-09': 1 },
  FR07044: {},
  FR07045: { '2026-09': 4 },
  FR07046: { '2026-05': 1, '2026-06': 1 },
  FR07047: { '2026-07': 5 },
  FR07048: { '2026-04': 2, '2026-05': 2, '2026-07': 2 },
  FR07049: { '2026-05': 3, '2026-07': 1, '2026-08': 2 },
  FR07050: { '2026-06': 1, '2026-07': 1, '2026-08': 3, '2026-09': 2 },
  FR07051: { '2026-04': 1, '2026-05': 1, '2026-06': 2, '2026-07': 1, '2026-08': 1, '2026-09': 3 },
  FR07052: { '2026-05': 1, '2026-06': 3, '2026-07': 2 },
  FR07053: { '2026-04': 1, '2026-05': 2, '2026-06': 1, '2026-07': 2, '2026-08': 3 },
  FR07054: { '2026-07': 2, '2026-09': 2 },
  FR07055: { '2026-04': 3 },
  FR07056: { '2026-06': 5, '2026-07': 1 },
  FR07057: { '2026-04': 1, '2026-05': 3, '2026-08': 1 },
  FR07058: { '2026-05': 1, '2026-07': 2, '2026-08': 3 },
  FR07059: { '2026-04': 2, '2026-05': 4, '2026-07': 1, '2026-08': 2 },
  FR07060: { '2026-05': 3, '2026-06': 1, '2026-09': 2 },
  FR07061: { '2026-05': 1, '2026-07': 1, '2026-08': 1 },
  FR07062: { '2026-04': 3, '2026-05': 1, '2026-07': 2, '2026-08': 1, '2026-09': 2 },
  FR07063: { '2026-07': 1, '2026-09': 3 },
  FR07064: { '2026-04': 1, '2026-07': 1, '2026-08': 1, '2026-09': 1 },
  FR07065: { '2026-04': 2, '2026-07': 2, '2026-08': 1 },
  FR07066: { '2026-04': 2, '2026-07': 1, '2026-09': 1 },
  FR07067: {},
  FR07068: { '2026-07': 1 },
  FR07069: { '2026-04': 2, '2026-06': 3, '2026-09': 1 },
  FR07070: { '2026-09': 1 },
  FR07071: { '2026-04': 2, '2026-08': 1, '2026-09': 1 },
  FR07072: { '2026-04': 1, '2026-05': 1, '2026-07': 4 },
  FR07073: { '2026-07': 3 },
  FR07074: { '2026-08': 3 },
  FR07075: {},
  FR07076: { '2026-09': 3 },
  FR07077: {},
  FR07078: {},
  FR07079: {},
  FR07080: {},
};

function isAnnualLeaveType(leaveType) {
  const t = String(leaveType || '').trim().toLowerCase();
  return t === 'cuti_tahunan' || t === 'annual_leave' || t === 'cuti';
}

async function recalculateUserLeaveUsedDays(pool, userId) {
  if (!userId) return 0;
  // 1. Historical baseline + manual adjustment from ledger
  const ledgerRes = await pool.query(`
    SELECT COALESCE(SUM(days_delta), 0) AS ledger_days
    FROM hrm_leave_ledger
    WHERE user_id = $1
      AND entry_type IN ('HISTORICAL_BASELINE', 'MANUAL_ADJUSTMENT')
  `, [userId]);
  const ledgerDays = parseInt(ledgerRes.rows[0]?.ledger_days || 0, 10);

  // 2. Active annual leave requests (pending = langsung potong saat pengajuan, approved = tetap terhitung)
  const reqRes = await pool.query(`
    SELECT COALESCE(SUM(total_days), 0) AS req_days
    FROM hrm_leave_requests
    WHERE user_id = $1
      AND LOWER(leave_type) IN ('cuti_tahunan', 'annual_leave', 'cuti')
      AND status IN ('pending', 'approved')
      AND start_date >= '2026-10-01'
  `, [userId]);
  const reqDays = parseInt(reqRes.rows[0]?.req_days || 0, 10);

  const totalUsed = Math.max(0, ledgerDays + reqDays);
  await pool.query(
    'UPDATE hrm_profiles SET used_leave_days = $1, updated_at = NOW() WHERE id = $2',
    [totalUsed, userId]
  );
  return totalUsed;
}

async function seedOfficialLeaveBaselines(pool) {
  const profRes = await pool.query(
    'SELECT id, nip, email, full_name, annual_leave_quota, used_leave_days FROM hrm_profiles WHERE is_active = true'
  );
  let syncedCount = 0;

  for (const p of profRes.rows) {
    const group = classifyFrpGroup(p);
    if (group === 'OTHER') continue;

    const normNip = normalizeNip(p.nip);
    const targetQuota = group === 'SHIPMENT' ? 9 : 12;
    if (Number(p.annual_leave_quota) !== targetQuota) {
      await pool.query('UPDATE hrm_profiles SET annual_leave_quota = $1 WHERE id = $2', [targetQuota, p.id]);
    }

    if (group === 'RUMAH TANGGA' || group === 'SHIPMENT') {
      const monthMap = group === 'RUMAH TANGGA'
        ? (RUMAH_TANGGA_BASELINE[normNip] || {})
        : (SHIPMENT_BASELINE[normNip] || {});

      for (const [mKey, days] of Object.entries(monthMap)) {
        if (!days || days <= 0) continue;
        await pool.query(`
          INSERT INTO hrm_leave_ledger (user_id, leave_request_id, month_key, entry_type, days_delta, notes, created_by)
          VALUES ($1, NULL, $2, 'HISTORICAL_BASELINE', $3, $4, 'SYSTEM_EXCEL_SYNC')
          ON CONFLICT (user_id, month_key, entry_type) WHERE entry_type = 'HISTORICAL_BASELINE'
          DO UPDATE SET days_delta = EXCLUDED.days_delta, notes = EXCLUDED.notes;
        `, [p.id, mKey, days, `Rekap Resmi ${group} (${mKey})`]);
      }
      syncedCount++;
    } else if (group === 'KARYAWAN TETAP') {
      // Pertahankan riwayat existing jika belum ada entry baseline di ledger
      const existRes = await pool.query(
        "SELECT 1 FROM hrm_leave_ledger WHERE user_id = $1 AND entry_type = 'HISTORICAL_BASELINE' LIMIT 1",
        [p.id]
      );
      if (existRes.rows.length === 0) {
        const postOctRes = await pool.query(`
          SELECT COALESCE(SUM(total_days), 0) AS d
          FROM hrm_leave_requests
          WHERE user_id = $1
            AND LOWER(leave_type) IN ('cuti_tahunan', 'annual_leave', 'cuti')
            AND status IN ('pending', 'approved')
            AND start_date >= '2026-10-01'
        `, [p.id]);
        const postOctDays = parseInt(postOctRes.rows[0]?.d || 0, 10);
        const priorDays = Math.max(0, Number(p.used_leave_days || 0) - postOctDays);
        if (priorDays > 0) {
          await pool.query(`
            INSERT INTO hrm_leave_ledger (user_id, leave_request_id, month_key, entry_type, days_delta, notes, created_by)
            VALUES ($1, NULL, '2026-09', 'HISTORICAL_BASELINE', $2, 'Saldo Terpakai Awal Karyawan Tetap', 'SYSTEM_INITIAL_SYNC')
            ON CONFLICT (user_id, month_key, entry_type) WHERE entry_type = 'HISTORICAL_BASELINE'
            DO NOTHING;
          `, [p.id, priorDays]);
        }
      }
      syncedCount++;
    }

    await recalculateUserLeaveUsedDays(pool, p.id);
  }
  return syncedCount;
}

async function recordLeaveSubmitLedger(pool, { userId, leaveRequestId, leaveType, startDate, totalDays, status, operatorName }) {
  if (!isAnnualLeaveType(leaveType)) {
    return recalculateUserLeaveUsedDays(pool, userId);
  }
  const monthKey = String(startDate || new Date().toISOString()).slice(0, 7);
  const entryType = status === 'approved' ? 'CONFIRMED_APPROVED' : 'RESERVE_ON_SUBMIT';
  await pool.query(`
    INSERT INTO hrm_leave_ledger (user_id, leave_request_id, month_key, entry_type, days_delta, notes, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (leave_request_id, entry_type) WHERE leave_request_id IS NOT NULL
    DO UPDATE SET days_delta = EXCLUDED.days_delta, notes = EXCLUDED.notes;
  `, [
    userId,
    leaveRequestId,
    monthKey,
    entryType,
    Number(totalDays || 1),
    status === 'approved' ? 'Cuti Disetujui Langsung (Auto-Potong)' : 'Potong Otomatis Saat Pengajuan Cuti (Reserved)',
    operatorName || 'EMPLOYEE_SUBMIT',
  ]);
  return recalculateUserLeaveUsedDays(pool, userId);
}

async function recordLeaveDecisionLedger(pool, { leave, decision, approverName }) {
  if (!leave || !leave.user_id) return 0;
  if (!isAnnualLeaveType(leave.leave_type)) {
    return recalculateUserLeaveUsedDays(pool, leave.user_id);
  }
  const startStr = leave.start_date instanceof Date
    ? leave.start_date.toISOString().slice(0, 10)
    : String(leave.start_date || '').slice(0, 10);
  const monthKey = startStr.slice(0, 7) || new Date().toISOString().slice(0, 7);
  const days = Number(leave.total_days || 1);

  if (decision === 'approved') {
    await pool.query(`
      INSERT INTO hrm_leave_ledger (user_id, leave_request_id, month_key, entry_type, days_delta, notes, created_by)
      VALUES ($1, $2, $3, 'CONFIRMED_APPROVED', $4, $5, $6)
      ON CONFLICT (leave_request_id, entry_type) WHERE leave_request_id IS NOT NULL
      DO NOTHING;
    `, [leave.user_id, leave.id, monthKey, days, `Disetujui oleh ${approverName || 'Atasan'}`, approverName || 'APPROVER']);
  } else if (decision === 'rejected' || decision === 'cancelled') {
    await pool.query(`
      INSERT INTO hrm_leave_ledger (user_id, leave_request_id, month_key, entry_type, days_delta, notes, created_by)
      VALUES ($1, $2, $3, 'REFUND_REJECTED', $4, $5, $6)
      ON CONFLICT (leave_request_id, entry_type) WHERE leave_request_id IS NOT NULL
      DO NOTHING;
    `, [leave.user_id, leave.id, monthKey, -days, `Pengembalian saldo (${decision}) oleh ${approverName || 'Atasan'}`, approverName || 'APPROVER']);
  }
  return recalculateUserLeaveUsedDays(pool, leave.user_id);
}

async function buildExecutiveLeaveRecap(pool) {
  const profRes = await pool.query(`
    SELECT p.id, p.nip, p.email, p.full_name, p.annual_leave_quota, p.used_leave_days,
           d.name AS division_name, r.name AS role_name
    FROM hrm_profiles p
    LEFT JOIN hrm_divisions d ON p.division_id = d.id
    LEFT JOIN hrm_roles r ON p.role_id = r.id
    WHERE p.is_active = true
  `);

  const ledgerRes = await pool.query(`
    SELECT user_id, month_key, entry_type, SUM(days_delta)::int AS days
    FROM hrm_leave_ledger
    WHERE entry_type IN ('HISTORICAL_BASELINE', 'MANUAL_ADJUSTMENT')
    GROUP BY user_id, month_key, entry_type
  `);

  const reqRes = await pool.query(`
    SELECT id, user_id, leave_type, start_date, end_date, total_days, status
    FROM hrm_leave_requests
    WHERE LOWER(leave_type) IN ('cuti_tahunan', 'annual_leave', 'cuti')
      AND status IN ('pending', 'approved')
      AND start_date >= '2026-10-01'
  `);

  const baselineMap = {};
  const manualMap = {};
  for (const row of ledgerRes.rows) {
    if (row.entry_type === 'HISTORICAL_BASELINE') {
      baselineMap[row.user_id] = baselineMap[row.user_id] || {};
      baselineMap[row.user_id][row.month_key] = (baselineMap[row.user_id][row.month_key] || 0) + Number(row.days || 0);
    } else if (row.entry_type === 'MANUAL_ADJUSTMENT') {
      manualMap[row.user_id] = (manualMap[row.user_id] || 0) + Number(row.days || 0);
    }
  }

  const reqByUser = {};
  for (const r of reqRes.rows) {
    reqByUser[r.user_id] = reqByUser[r.user_id] || [];
    reqByUser[r.user_id].push(r);
  }

  const RT_MONTHS = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02'];
  const SHP_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];

  const buildRows = (groupName, monthKeys) => {
    const members = profRes.rows
      .filter((p) => classifyFrpGroup(p) === groupName)
      .sort((a, b) => extractFrpSequence(a.nip) - extractFrpSequence(b.nip) || String(a.full_name).localeCompare(String(b.full_name)));

    return members.map((p, idx) => {
      const months = {};
      const pendingMonths = {};
      for (const mk of monthKeys) {
        months[mk] = (baselineMap[p.id]?.[mk] || 0);
        pendingMonths[mk] = 0;
      }

      let approvedPostOct = 0;
      let pendingPostOct = 0;
      for (const req of (reqByUser[p.id] || [])) {
        const sStr = req.start_date instanceof Date ? req.start_date.toISOString().slice(0, 10) : String(req.start_date).slice(0, 10);
        const mk = sStr.slice(0, 7);
        const days = Number(req.total_days || 1);
        if (months[mk] !== undefined) {
          months[mk] += days;
        }
        if (req.status === 'pending') {
          pendingPostOct += days;
          if (pendingMonths[mk] !== undefined) pendingMonths[mk] += days;
        } else {
          approvedPostOct += days;
        }
      }

      const baselineTotal = Object.values(baselineMap[p.id] || {}).reduce((s, v) => s + Number(v || 0), 0);
      const manualAdj = Number(manualMap[p.id] || 0);
      const totalUsed = Math.max(0, baselineTotal + manualAdj + approvedPostOct + pendingPostOct);
      const quota = Number(p.annual_leave_quota || (groupName === 'SHIPMENT' ? 9 : 12));
      const remaining = Math.max(0, quota - totalUsed);

      return {
        no: idx + 1,
        userId: p.id,
        nip: p.nip,
        fullName: p.full_name,
        divisionName: p.division_name || '-',
        roleName: p.role_name || 'Karyawan',
        group: groupName,
        quota,
        months,
        pendingMonths,
        manualAdjustment: manualAdj,
        approvedUsedDays: Math.max(0, baselineTotal + manualAdj + approvedPostOct),
        pendingDays: pendingPostOct,
        usedLeaveDays: totalUsed,
        remainingLeaveDays: remaining,
      };
    });
  };

  const rumahTangga = buildRows('RUMAH TANGGA', RT_MONTHS);
  const shipment = buildRows('SHIPMENT', SHP_MONTHS);
  const karyawanTetap = buildRows('KARYAWAN TETAP', RT_MONTHS);

  const summarize = (rows, monthKeys) => {
    const monthlyTotals = {};
    for (const mk of monthKeys) {
      monthlyTotals[mk] = rows.reduce((s, r) => s + (r.months[mk] || 0), 0);
    }
    return {
      totalEmployees: rows.length,
      totalQuota: rows.reduce((s, r) => s + r.quota, 0),
      totalUsed: rows.reduce((s, r) => s + r.usedLeaveDays, 0),
      totalPending: rows.reduce((s, r) => s + r.pendingDays, 0),
      totalRemaining: rows.reduce((s, r) => s + r.remainingLeaveDays, 0),
      exhaustedCount: rows.filter((r) => r.remainingLeaveDays === 0).length,
      monthlyTotals,
    };
  };

  return {
    generatedAt: new Date().toISOString(),
    rumahTangga: {
      title: 'REKAP CUTI RUMAH TANGGA DAN WISMA TAHUN KE 2 (MAR 2026 - FEB 2027)',
      periodLabel: 'Maret 2026 – Februari 2027',
      defaultQuota: 12,
      monthKeys: RT_MONTHS,
      rows: rumahTangga,
      summary: summarize(rumahTangga, RT_MONTHS),
    },
    shipment: {
      title: 'REKAPAN CUTI ADENDDUM SHIPMENT PT FAWWAZ RESKI PERWIRA (APR - DES 2026)',
      periodLabel: 'April – Desember 2026',
      defaultQuota: 9,
      monthKeys: SHP_MONTHS,
      rows: shipment,
      summary: summarize(shipment, SHP_MONTHS),
    },
    karyawanTetap: {
      title: 'REKAP CUTI KARYAWAN TETAP KHUSUS PIMPINAN (ASLAM, SAMSI, TAKDIR)',
      periodLabel: 'Maret 2026 – Februari 2027',
      defaultQuota: 12,
      monthKeys: RT_MONTHS,
      rows: karyawanTetap,
      summary: summarize(karyawanTetap, RT_MONTHS),
    },
  };
}

function getPreviousMonthKey(payrollMonthKey) {
  const [yStr, mStr] = String(payrollMonthKey || '').split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (!y || !m) {
    const d = new Date();
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  }
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

function calculateFwpOvertimeServer(baseSalary, rawHours, isDayShift, overrideRate) {
  const effectiveSalary = Number(baseSalary || 4045050);
  const hourlyRate = overrideRate && overrideRate > 0 ? Number(overrideRate) : (effectiveSalary / 173);
  const maxRealHours = isDayShift ? 56 : 30;
  const cappedRealHours = Math.min(Number(rawHours || 0), maxRealHours);
  const paidHours = cappedRealHours * 2;
  const totalPay = Math.round(paidHours * hourlyRate);
  return { hourlyRate, maxRealHours, cappedRealHours, paidHours, totalPay };
}

function resolveEffectiveBudgets(targetPayrollMonth, linkedPeriod) {
  const defaultShip = 65000000;
  const defaultWisma = 4000000;
  const shipmentCap =
    linkedPeriod && linkedPeriod.effective_shipment_budget != null && Number(linkedPeriod.effective_shipment_budget) > 0
      ? Number(linkedPeriod.effective_shipment_budget)
      : defaultShip;
  const wismaCap =
    linkedPeriod && linkedPeriod.effective_wisma_budget != null && Number(linkedPeriod.effective_wisma_budget) >= 0
      ? Number(linkedPeriod.effective_wisma_budget)
      : defaultWisma;
  const targetMin =
    linkedPeriod && linkedPeriod.target_efficiency_min != null && Number(linkedPeriod.target_efficiency_min) > 0
      ? Number(linkedPeriod.target_efficiency_min)
      : Math.min(55000000, shipmentCap);
  const targetMax =
    linkedPeriod && linkedPeriod.target_efficiency_max != null && Number(linkedPeriod.target_efficiency_max) > 0
      ? Number(linkedPeriod.target_efficiency_max)
      : Math.min(60000000, shipmentCap);
  const strictGateEnabled =
    linkedPeriod && linkedPeriod.strict_gate_enabled !== undefined && linkedPeriod.strict_gate_enabled !== null
      ? Boolean(linkedPeriod.strict_gate_enabled)
      : true;
  const totalCap = shipmentCap + wismaCap;
  return {
    shipmentCap,
    wismaCap,
    totalCap,
    targetMin,
    targetMax: Math.max(targetMin, Math.min(targetMax, shipmentCap)),
    strictGateEnabled,
    skShipmentCap: 72000000,
    skWismaCap: 4000000,
    skTotalCap: 76000000,
    isEffectiveOverride: shipmentCap !== 72000000 || wismaCap !== 4000000,
    perWismaPersonCap: wismaCap > 0 ? Math.floor(wismaCap / 33) : 0,
  };
}

async function buildPayrollArrearsOvertimeRecap(pool, payrollMonthKey) {
  const targetPayrollMonth = payrollMonthKey || new Date().toISOString().slice(0, 7);
  const sourceOvertimeMonth = getPreviousMonthKey(targetPayrollMonth);

  const profRes = await pool.query(`
    SELECT p.id, p.nip, p.email, p.full_name,
           d.name AS division_name, s.name AS shift_name,
           COALESCE(sp.base_salary, 4045050) AS effective_salary,
           sp.hourly_overtime_rate
    FROM hrm_profiles p
    LEFT JOIN hrm_divisions d ON p.division_id = d.id
    LEFT JOIN hrm_shifts s ON p.shift_id = s.id
    LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
    WHERE p.is_active = true
  `);

  const otRes = await pool.query(`
    SELECT o.*, p.nip AS user_nip, p.full_name AS user_name
    FROM hrm_overtime_records o
    JOIN hrm_profiles p ON o.user_id = p.id
    WHERE TO_CHAR(o.date, 'YYYY-MM') = $1
    ORDER BY o.date ASC, p.nip ASC
  `, [sourceOvertimeMonth]);

  const [py, pm] = targetPayrollMonth.split('-').map(Number);
  const periodRes = await pool.query(
    'SELECT * FROM hrm_payroll_periods WHERE year = $1 AND month = $2 LIMIT 1',
    [py, pm]
  );
  const linkedPeriod = periodRes.rows[0] || null;
  const budgetMeta = resolveEffectiveBudgets(targetPayrollMonth, linkedPeriod);

  const otByUser = {};
  for (const r of otRes.rows) {
    if (!otByUser[r.user_id]) otByUser[r.user_id] = [];
    otByUser[r.user_id].push(r);
  }

  let employees = profRes.rows
    .filter((p) => isOfficialFrpEmployee(p))
    .sort((a, b) => extractFrpSequence(a.nip) - extractFrpSequence(b.nip) || String(a.full_name).localeCompare(String(b.full_name)))
    .map((p) => {
      const group = classifyFrpGroup(p);
      const normNip = normalizeNip(p.nip);
      const isOvertimeEligible = group !== 'KARYAWAN TETAP';
      const isDayShift = DAY_SHIFT_NIPS.has(normNip) || String(p.shift_name || '').toUpperCase().includes('DAY');

      // Kebijakan Direksi PT FRP: Karyawan Tetap (Aslam, Samsi, Takdir) TIDAK diperlakukan lembur (Non-Lembur / 0 SPKL).
      if (!isOvertimeEligible) {
        return {
          userId: p.id,
          nip: p.nip,
          fullName: p.full_name,
          divisionName: p.division_name || '-',
          group,
          isOvertimeEligible: false,
          isDayShift,
          baseSalary: Number(p.effective_salary || 4045050),
          hourlyRate: 0,
          spklApprovedCount: 0,
          spklPendingCount: 0,
          rawApprovedHours: 0,
          cappedRealHours: 0,
          paidHours: 0,
          flexytimeHours: 0,
          rawCalculatedPay: 0,
          calculatedPay: 0,
          recordedCompensationSum: 0,
          syncState: 'non_overtime_exempt',
          overtimeIds: [],
        };
      }

      const userOts = otByUser[p.id] || [];
      const approvedOts = userOts.filter((r) => r.status === 'approved' || r.status === 'completed');
      const pendingOts = userOts.filter((r) => r.status === 'pending');

      const rawApprovedHours = approvedOts.reduce((s, r) => s + Number(r.approved_hours ?? r.duration_hours ?? 0), 0);
      const calc = calculateFwpOvertimeServer(p.effective_salary, rawApprovedHours, isDayShift, p.hourly_overtime_rate);

      // Rumah Tangga: Effective wisma budget dibagi rata 33 orang; lebihnya Flexytime
      let finalPay = calc.totalPay;
      let flexytimeHours = 0;
      if (group === 'RUMAH TANGGA') {
        const capRp = budgetMeta.perWismaPersonCap;
        if (finalPay > capRp && rawApprovedHours > 0) {
          const flexyRatio = (finalPay - capRp) / finalPay;
          flexytimeHours = Number((rawApprovedHours * flexyRatio).toFixed(1));
          finalPay = capRp;
        }
      }

      const paidCount = approvedOts.filter((r) => r.payment_status === 'paid').length;
      const includedCount = approvedOts.filter((r) => r.payment_status === 'included_in_payroll').length;
      let syncState = 'no_overtime';
      if (approvedOts.length > 0) {
        if (paidCount === approvedOts.length) syncState = 'paid';
        else if (paidCount + includedCount === approvedOts.length) syncState = 'included_in_payroll';
        else syncState = 'ready_for_payroll';
      }

      return {
        userId: p.id,
        nip: p.nip,
        fullName: p.full_name,
        divisionName: p.division_name || '-',
        group,
        isOvertimeEligible: true,
        isDayShift,
        baseSalary: Number(p.effective_salary || 4045050),
        hourlyRate: Number(calc.hourlyRate.toFixed(2)),
        spklApprovedCount: approvedOts.length,
        spklPendingCount: pendingOts.length,
        rawApprovedHours: Number(rawApprovedHours.toFixed(2)),
        cappedRealHours: Number(calc.cappedRealHours.toFixed(2)),
        paidHours: Number(calc.paidHours.toFixed(2)),
        flexytimeHours,
        rawCalculatedPay: finalPay,
        calculatedPay: finalPay,
        recordedCompensationSum: Math.round(approvedOts.reduce((s, r) => s + Number(r.compensation_amount || 0), 0)),
        syncState,
        overtimeIds: approvedOts.map((r) => r.id),
      };
    });

  // Enforce Effective Shipment Cap cleanly (pro-rata scaling only when raw Shipment total exceeds budgetMeta.shipmentCap)
  const rawShipmentTotal = employees
    .filter((e) => e.group === 'SHIPMENT')
    .reduce((s, e) => s + e.rawCalculatedPay, 0);
  const shipmentScaleFactor =
    rawShipmentTotal > budgetMeta.shipmentCap && budgetMeta.shipmentCap > 0
      ? budgetMeta.shipmentCap / rawShipmentTotal
      : 1;
  if (shipmentScaleFactor < 1) {
    employees = employees.map((e) =>
      e.group === 'SHIPMENT'
        ? { ...e, calculatedPay: Math.floor(e.rawCalculatedPay * shipmentScaleFactor) }
        : e
    );
  }

  const groupTotals = (grp) => {
    const list = employees.filter((e) => e.group === grp);
    const totalPay = list.reduce((s, e) => s + e.calculatedPay, 0);
    const rawTotalPay = list.reduce((s, e) => s + e.rawCalculatedPay, 0);
    const budgetCap = grp === 'SHIPMENT' ? budgetMeta.shipmentCap : grp === 'RUMAH TANGGA' ? budgetMeta.wismaCap : 0;
    return {
      employeeCount: list.length,
      withOvertimeCount: list.filter((e) => e.spklApprovedCount > 0).length,
      totalRawHours: Number(list.reduce((s, e) => s + e.rawApprovedHours, 0).toFixed(2)),
      totalPaidHours: Number(list.reduce((s, e) => s + e.paidHours, 0).toFixed(2)),
      totalFlexytimeHours: Number(list.reduce((s, e) => s + e.flexytimeHours, 0).toFixed(2)),
      rawTotalPay,
      totalPay,
      budgetCap,
      budgetRemaining: budgetCap > 0 ? Math.max(0, budgetCap - totalPay) : 0,
      isProratedToCap: grp === 'SHIPMENT' && shipmentScaleFactor < 1,
      readyCount: list.filter((e) => e.syncState === 'ready_for_payroll').length,
      includedCount: list.filter((e) => e.syncState === 'included_in_payroll').length,
      paidCount: list.filter((e) => e.syncState === 'paid').length,
    };
  };

  return {
    payrollMonth: targetPayrollMonth,
    sourceOvertimeMonth,
    linkedPeriod,
    budgetMeta: {
      ...budgetMeta,
      shipmentScaleFactor: Number(shipmentScaleFactor.toFixed(6)),
      isShipmentProrated: shipmentScaleFactor < 1,
    },
    totals: {
      rumahTangga: groupTotals('RUMAH TANGGA'),
      shipment: groupTotals('SHIPMENT'),
      karyawanTetap: groupTotals('KARYAWAN TETAP'),
      grandTotalPay: employees.reduce((s, e) => s + e.calculatedPay, 0),
      grandTotalHours: Number(employees.reduce((s, e) => s + e.rawApprovedHours, 0).toFixed(2)),
    },
    employees,
    records: otRes.rows,
  };
}

async function generateBackendPayrollForPeriod(pool, period) {
  const targetPayrollMonth = `${period.year}-${String(period.month).padStart(2, '0')}`;
  const arrears = await buildPayrollArrearsOvertimeRecap(pool, targetPayrollMonth);

  // Attendance counts for targetPayrollMonth (alpa & terlambat)
  const attRes = await pool.query(`
    SELECT user_id,
           COUNT(*) FILTER (WHERE status IN ('alfa', 'mangkir'))::int AS alpa_days,
           COALESCE(SUM(late_minutes) FILTER (WHERE status = 'terlambat'), 0)::int AS total_late_minutes
    FROM hrm_attendances
    WHERE TO_CHAR(attendance_date, 'YYYY-MM') = $1
    GROUP BY user_id
  `, [targetPayrollMonth]);
  const attMap = {};
  for (const r of attRes.rows) attMap[r.user_id] = r;

  const settingsRes = await pool.query('SELECT * FROM hrm_payroll_settings ORDER BY updated_at DESC LIMIT 1');
  const pSettings = settingsRes.rows[0] || {};
  const absenceRate = Number(pSettings.absence_deduction_per_day || 155000);

  const slipsCreated = [];
  const allLinkedOtIds = [];

  for (const emp of arrears.employees) {
    const baseSalary = emp.baseSalary || 4045050;
    const overtimePay = emp.calculatedPay || 0;
    const grossIncome = baseSalary + overtimePay;

    const bpjsKes = Math.round(baseSalary * 0.01);
    const bpjsTk = Math.round(baseSalary * 0.03);
    const alpaDays = Number(attMap[emp.userId]?.alpa_days || 0);
    const absenceDeduction = alpaDays * absenceRate;
    const totalDeductions = bpjsKes + bpjsTk + absenceDeduction;
    const netSalary = Math.max(0, grossIncome - totalDeductions);

    const slipRes = await pool.query(`
      INSERT INTO hrm_payroll_slips (
        period_id, user_id, period_label, base_salary,
        position_allowance, meal_allowance, transport_allowance, other_allowances,
        total_overtime_pay, gross_income, late_deduction, absence_deduction,
        bpjs_kesehatan_deduction, bpjs_ketenagakerjaan_deduction, tax_deduction,
        total_deductions, net_salary, alpa_days, alpa_rate, status,
        notes, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        0, 0, 0, '[]'::jsonb,
        $5, $6, 0, $7,
        $8, $9, 0,
        $10, $11, $12, $13, 'draft',
        $14, NOW()
      )
      ON CONFLICT (period_id, user_id) DO UPDATE SET
        period_label = EXCLUDED.period_label,
        base_salary = EXCLUDED.base_salary,
        total_overtime_pay = EXCLUDED.total_overtime_pay,
        gross_income = EXCLUDED.gross_income,
        absence_deduction = EXCLUDED.absence_deduction,
        bpjs_kesehatan_deduction = EXCLUDED.bpjs_kesehatan_deduction,
        bpjs_ketenagakerjaan_deduction = EXCLUDED.bpjs_ketenagakerjaan_deduction,
        tax_deduction = 0,
        total_deductions = EXCLUDED.total_deductions,
        net_salary = EXCLUDED.net_salary,
        alpa_days = EXCLUDED.alpa_days,
        alpa_rate = EXCLUDED.alpa_rate,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *;
    `, [
      period.id,
      emp.userId,
      period.period_label,
      baseSalary,
      overtimePay,
      grossIncome,
      absenceDeduction,
      bpjsKes,
      bpjsTk,
      totalDeductions,
      netSalary,
      alpaDays,
      absenceRate,
      `Lembur disinkronkan dari periode kerja ${arrears.sourceOvertimeMonth} (Sistem Bulan Mundur N-1)`,
    ]);
    slipsCreated.push(slipRes.rows[0]);
    allLinkedOtIds.push(...emp.overtimeIds);
  }

  if (allLinkedOtIds.length > 0) {
    await pool.query(`
      UPDATE hrm_overtime_records
      SET payment_status = CASE WHEN payment_status = 'paid' THEN 'paid' ELSE 'included_in_payroll' END,
          payroll_period_id = $1,
          updated_at = NOW()
      WHERE id = ANY($2::uuid[])
    `, [period.id, allLinkedOtIds]);
  }

  const totalGross = slipsCreated.reduce((s, r) => s + Number(r.gross_income || 0), 0);
  const totalDed = slipsCreated.reduce((s, r) => s + Number(r.total_deductions || 0), 0);
  const totalNet = slipsCreated.reduce((s, r) => s + Number(r.net_salary || 0), 0);

  await pool.query(`
    UPDATE hrm_payroll_periods
    SET status = CASE WHEN status = 'paid' THEN 'paid' ELSE 'processing' END,
        total_employees = $1,
        total_gross = $2,
        total_deductions = $3,
        total_net = $4,
        updated_at = NOW()
    WHERE id = $5
  `, [slipsCreated.length, totalGross, totalDed, totalNet, period.id]);

  return {
    periodId: period.id,
    periodLabel: period.period_label,
    sourceOvertimeMonth: arrears.sourceOvertimeMonth,
    slipsCount: slipsCreated.length,
    overtimeSyncedCount: allLinkedOtIds.length,
    totalOvertimePay: arrears.totals.grandTotalPay,
    totalGross,
    totalNet,
  };
}

function getNextMonthKey(workMonthKey) {
  const [yStr, mStr] = String(workMonthKey || '').split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (!y || !m) {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

async function buildShipmentCostControlRadar(pool, workMonthKey) {
  const wm = /^\d{4}-\d{2}$/.test(String(workMonthKey || ''))
    ? String(workMonthKey)
    : new Date().toISOString().slice(0, 7);
  const payrollMonth = getNextMonthKey(wm);
  const arrears = await buildPayrollArrearsOvertimeRecap(pool, payrollMonth);
  const budgets = arrears.budgetMeta;

  const shipmentEmployees = arrears.employees.filter((e) => e.group === 'SHIPMENT');
  const shipmentUserIds = new Set(shipmentEmployees.map((e) => e.userId));
  const shipmentRecords = (arrears.records || []).filter((r) => shipmentUserIds.has(r.user_id));

  const approvedRecs = shipmentRecords.filter((r) => r.status === 'approved' || r.status === 'completed');
  const pendingRecs = shipmentRecords.filter((r) => r.status === 'pending');

  const approvedPay = approvedRecs.reduce((s, r) => s + Number(r.compensation_amount || 0), 0);
  const approvedHours = approvedRecs.reduce((s, r) => s + Number(r.approved_hours ?? r.duration_hours ?? 0), 0);
  const pendingPay = pendingRecs.reduce((s, r) => s + Number(r.compensation_amount || 0), 0);
  const pendingHours = pendingRecs.reduce((s, r) => s + Number(r.duration_hours || 0), 0);
  const committedPay = approvedPay + pendingPay;

  // Calendar Burn-Rate Projection in Asia/Makassar (WITA)
  const [wy, wmo] = wm.split('-').map(Number);
  const totalDays = new Date(wy, wmo, 0).getDate();
  const witaNowStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }); // YYYY-MM-DD
  const curYm = witaNowStr.slice(0, 7);
  let elapsedDays = totalDays;
  if (wm === curYm) {
    elapsedDays = Math.max(1, Math.min(totalDays, parseInt(witaNowStr.slice(8, 10), 10) || 1));
  } else if (wm > curYm) {
    elapsedDays = 1;
  }
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const dailyAvgPay = Math.round(approvedPay / elapsedDays);
  const projectedMonthEndPay = wm === curYm ? Math.round(dailyAvgPay * totalDays) : approvedPay;
  const isProjectedBoncos = projectedMonthEndPay > budgets.targetMax || committedPay > budgets.targetMax;

  const safeDivDays = Math.max(1, remainingDays);
  const safeDailyPayForTargetMin = Math.max(0, Math.round((budgets.targetMin - approvedPay) / safeDivDays));
  const safeDailyPayForTargetMax = Math.max(0, Math.round((budgets.targetMax - approvedPay) / safeDivDays));
  const avgHourlyRate2x = 23381.79 * 2;
  const safeDailyHoursForTargetMax = Number((safeDailyPayForTargetMax / avgHourlyRate2x).toFixed(1));

  let zone = 'GREEN_AMAN';
  if (approvedPay >= budgets.shipmentCap) zone = 'RED_HARDCAP_65JT';
  else if (approvedPay > budgets.targetMax) zone = 'ORANGE_KETAT_60JT';
  else if (approvedPay >= budgets.targetMin || committedPay > budgets.targetMax) zone = 'YELLOW_WASPADA_55JT';

  const topSpenders = [...shipmentEmployees]
    .filter((e) => e.spklApprovedCount > 0 || e.spklPendingCount > 0)
    .sort((a, b) => b.calculatedPay - a.calculatedPay || b.rawApprovedHours - a.rawApprovedHours)
    .slice(0, 8)
    .map((e) => ({
      userId: e.userId,
      nip: e.nip,
      fullName: e.fullName,
      divisionName: e.divisionName,
      isDayShift: e.isDayShift,
      maxHoursCap: e.isDayShift ? 56 : 30,
      rawApprovedHours: e.rawApprovedHours,
      spklApprovedCount: e.spklApprovedCount,
      spklPendingCount: e.spklPendingCount,
      calculatedPay: e.calculatedPay,
      utilizationPct: Math.min(100, Math.round((e.rawApprovedHours / (e.isDayShift ? 56 : 30)) * 100)),
    }));

  const pendingQueue = [...pendingRecs]
    .sort((a, b) => Number(b.compensation_amount || 0) - Number(a.compensation_amount || 0))
    .slice(0, 12)
    .map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userNip: r.user_nip,
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
      durationHours: Number(r.duration_hours || 0),
      compensationAmount: Math.round(Number(r.compensation_amount || 0)),
      taskDescription: r.task_description,
    }));

  const lowUtilizationCount = shipmentEmployees.filter((e) => e.rawApprovedHours < 10).length;
  const savingsRecommendations = [];
  if (pendingPay > 0 && approvedPay + pendingPay > budgets.targetMax) {
    savingsRecommendations.push(
      `Tahan/seleksi ${pendingRecs.length} antrean SPKL pending senilai Rp ${Math.round(pendingPay).toLocaleString('id-ID')} agar realisasi + antrean tidak melampaui target Rp ${(budgets.targetMax / 1e6).toFixed(0)} jt.`
    );
  }
  if (isProjectedBoncos && wm === curYm) {
    savingsRecommendations.push(
      `Laju pengeluaran harian saat ini Rp ${dailyAvgPay.toLocaleString('id-ID')}/hari (proyeksi akhir bulan Rp ${projectedMonthEndPay.toLocaleString('id-ID')}). Batasi persetujuan SPKL harian maksimal Rp ${safeDailyPayForTargetMax.toLocaleString('id-ID')}/hari (~${safeDailyHoursForTargetMax} jam/hari untuk seluruh tim).`
    );
  }
  if (lowUtilizationCount > 0) {
    savingsRecommendations.push(
      `Terdapat ${lowUtilizationCount} personil Shipment dengan jam lembur < 10 jam; prioritaskan rotasi/pengganti shift ke personil tersebut daripada menumpuk lembur panjang bertarif progresif.`
    );
  }
  if (savingsRecommendations.length === 0) {
    savingsRecommendations.push(
      `Realisasi & proyeksi masih aman di bawah target efisiensi Rp ${(budgets.targetMin / 1e6).toFixed(0)}–${(budgets.targetMax / 1e6).toFixed(0)} jt. Pertahankan pembatasan SPKL maksimal 2–3 jam/sesi di hari kerja.`
    );
  }

  return {
    workMonth: wm,
    payrollMonth,
    zone,
    budget: {
      targetMin: budgets.targetMin,
      targetMax: budgets.targetMax,
      hardCap: budgets.shipmentCap,
      wismaCap: budgets.wismaCap,
      strictGateEnabled: budgets.strictGateEnabled,
    },
    realization: {
      approvedPay: Math.round(approvedPay),
      approvedHours: Number(approvedHours.toFixed(1)),
      approvedCount: approvedRecs.length,
      pendingPay: Math.round(pendingPay),
      pendingHours: Number(pendingHours.toFixed(1)),
      pendingCount: pendingRecs.length,
      committedPay: Math.round(committedPay),
      remainingToTargetMin: Math.max(0, Math.round(budgets.targetMin - approvedPay)),
      remainingToTargetMax: Math.max(0, Math.round(budgets.targetMax - approvedPay)),
      remainingToHardCap: Math.max(0, Math.round(budgets.shipmentCap - approvedPay)),
    },
    burnRate: {
      elapsedDays,
      remainingDays,
      totalDays,
      dailyAvgPay,
      projectedMonthEndPay,
      isProjectedBoncos,
      projectedVarianceFromTargetMax: projectedMonthEndPay - budgets.targetMax,
      safeDailyPayForTargetMin,
      safeDailyPayForTargetMax,
      safeDailyHoursForTargetMax,
    },
    topSpenders,
    pendingQueue,
    savingsRecommendations,
  };
}

export {
  classifyFrpGroup,
  isOfficialFrpEmployee,
  recalculateUserLeaveUsedDays,
  seedOfficialLeaveBaselines,
  recordLeaveSubmitLedger,
  recordLeaveDecisionLedger,
  buildExecutiveLeaveRecap,
  resolveEffectiveBudgets,
  buildPayrollArrearsOvertimeRecap,
  generateBackendPayrollForPeriod,
  buildShipmentCostControlRadar,
};
