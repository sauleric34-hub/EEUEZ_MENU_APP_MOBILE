import 'package:flutter/material.dart';
import 'dart:math' as math;
import '../theme/app_theme.dart';

class BackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppTheme.secondary.withOpacity(0.03)
      ..style = PaintingStyle.fill;

    final random = math.Random(42); // Seed constante pour un motif stable

    // Dessiner des petits triangles aléatoires (style pyramides/topographie)
    for (var i = 0; i < 50; i++) {
      final x = random.nextDouble() * size.width;
      final y = random.nextDouble() * size.height;
      final triangleSize = random.nextDouble() * 40 + 10;

      final path = Path();
      path.moveTo(x, y);
      path.lineTo(x + triangleSize / 2, y + triangleSize);
      path.lineTo(x - triangleSize / 2, y + triangleSize);
      path.close();

      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class ThemedBackground extends StatelessWidget {
  final Widget child;
  const ThemedBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: CustomPaint(
            painter: BackgroundPainter(),
          ),
        ),
        child,
      ],
    );
  }
}
