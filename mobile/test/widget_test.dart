import 'package:flutter_test/flutter_test.dart';
import 'package:hrm_attendance_mobile/main.dart';

void main() {
  testWidgets('HRM Mobile App Smoke Test', (WidgetTester tester) async {
    await tester.pumpWidget(const HrmMobileApp());
    expect(find.byType(HrmMobileApp), findsOneWidget);
  });
}
