@echo off
:: Batch script untuk membuka akses Port 80 dan 443 di Windows Firewall
:: Agar HRM dapat diakses dari HP melalui jaringan Wi-Fi lokal

echo Mengaktifkan izin Port 80 dan 443 di Windows Firewall...
netsh advfirewall firewall add rule name="HRM Docker (Port 80)" dir=in action=allow protocol=TCP localport=80 profile=any
netsh advfirewall firewall add rule name="HRM Docker (Port 443)" dir=in action=allow protocol=TCP localport=443 profile=any

echo.
echo ========================================================
echo SUKSES! Port 80 dan 443 sudah diizinkan di semua profil.
echo Silakan coba akses kembali dari HP:
echo HTTP : http://192.168.1.4
echo HTTPS: https://192.168.1.4
echo ========================================================
pause
