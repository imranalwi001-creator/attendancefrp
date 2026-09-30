import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/constants/app_colors.dart';
import 'features/auth/presentation/screens/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Edge-to-edge system chrome styling
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: AppColors.surface,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  runApp(const HrmMobileApp());
}

class HrmMobileApp extends StatelessWidget {
  const HrmMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HRM Attendance System',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.background,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          primary: AppColors.primary,
          surface: AppColors.surface,
        ),
        splashFactory: InkSparkle.splashFactory,
      ),
      home: const LoginScreen(),
    );
  }
}
