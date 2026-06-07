import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/localization_service.dart';
import '../../services/shared_database_service.dart';
import 'order_tracking_screen.dart';

class CheckoutScreen extends StatefulWidget {
  final int totalAmount;
  const CheckoutScreen({super.key, required this.totalAmount});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String selectedPayment = 'Orange Money';
  bool isProcessing = false;

  void _processCheckout() {
    setState(() => isProcessing = true);
    
    // Simulate API delay
    Future.delayed(const Duration(seconds: 2), () {
      if (!mounted) return;
      _showPaymentSimulation();
    });
  }

  void _showPaymentSimulation() {
    showModalBottomSheet(
      context: context,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.transparent,
      builder: (context) => _PaymentSimulationSheet(
        amount: widget.totalAmount,
        provider: selectedPayment,
        onSuccess: () {
          final orderId = 'EEU-${DateTime.now().millisecondsSinceEpoch}';
          SharedDatabaseService().createOrder({
            'id': orderId,
            'total': widget.totalAmount + 500,
            'items': 'Commande de plats',
          });
          SharedDatabaseService().addLog('COMMANDE', 'Commande $orderId confirmée par le client via ${widget.provider}');
          Navigator.pop(context); // Close sheet
          _showOrderSuccess(orderId);
        },
      ),
    );
  }

  void _showOrderSuccess(String orderId) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
        content: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: AppTheme.accent.withOpacity(0.1), shape: BoxShape.circle),
                child: const Icon(Icons.check_circle_rounded, color: AppTheme.accent, size: 60),
              ),
              const SizedBox(height: 24),
              const Text(
                'Succès ! 🥳',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppTheme.primary),
              ),
              const SizedBox(height: 12),
              Text(
                'Votre commande est en préparation.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => OrderTrackingScreen(orderId: orderId)),
                  ),
                  child: Text(t('view_tracking')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Checkout'),
        centerTitle: true,
      ),
      body: isProcessing 
        ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
        : Padding(
            padding: const EdgeInsets.all(AppTheme.paddingLarge),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSummarySection(),
                const SizedBox(height: 40),
                Text(
                  t('confirm_payment'),
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.primary),
                ),
                const SizedBox(height: 20),
                _buildPaymentOption('Orange Money', Colors.orange),
                _buildPaymentOption('MTN MoMo', Colors.amber),
                const Spacer(),
                // Irreversible Action: Cancel
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(t('cancel').toUpperCase()),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _processCheckout,
                    child: Text('${t('checkout')} (${widget.totalAmount + 500} ${t('currency')})'),
                  ),
                ),
              ],
            ),
          ),
    );
  }

  Widget _buildSummarySection() {
    return Container(
      padding: const EdgeInsets.all(AppTheme.paddingLarge),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20)],
      ),
      child: Column(
        children: [
          _buildSummaryRow('Sous-total', '${widget.totalAmount} ${t('currency')}'),
          const SizedBox(height: 12),
          _buildSummaryRow('Livraison', '500 ${t('currency')}'),
          const Divider(height: 40, thickness: 1),
          _buildSummaryRow(t('total'), '${widget.totalAmount + 500} ${t('currency')}', isBold: true),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontWeight: isBold ? FontWeight.w900 : FontWeight.normal, fontSize: isBold ? 18 : 14, color: isBold ? AppTheme.primary : AppTheme.textMuted)),
        Text(value, style: TextStyle(fontWeight: isBold ? FontWeight.w900 : FontWeight.bold, fontSize: isBold ? 18 : 14, color: AppTheme.primary)),
      ],
    );
  }

  Widget _buildPaymentOption(String name, Color color) {
    bool isSelected = selectedPayment == name;
    return GestureDetector(
      onTap: () => setState(() => selectedPayment = name),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? color : Colors.transparent, width: 2),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(isSelected ? 0.05 : 0.02), blurRadius: 10)],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
              child: Icon(Icons.account_balance_wallet_rounded, color: color, size: 24),
            ),
            const SizedBox(width: 20),
            Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primary)),
            const Spacer(),
            if (isSelected) Icon(Icons.check_circle_rounded, color: color),
          ],
        ),
      ),
    );
  }
}

class _PaymentSimulationSheet extends StatefulWidget {
  final int amount;
  final String provider;
  final VoidCallback onSuccess;

  const _PaymentSimulationSheet({
    required this.amount,
    required this.provider,
    required this.onSuccess,
  });

  @override
  State<_PaymentSimulationSheet> createState() => _PaymentSimulationSheetState();
}

class _PaymentSimulationSheetState extends State<_PaymentSimulationSheet> {
  bool isAuthenticating = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(40)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 50, height: 5, decoration: BoxDecoration(color: Colors.grey.withOpacity(0.2), borderRadius: BorderRadius.circular(10))),
          const SizedBox(height: 40),
          Text(
            'Confirmation de Commande 📦',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppTheme.primary),
          ),
          const SizedBox(height: 16),
          Text(
            "Votre commande de ${widget.amount + 500} ${t('currency')} sera validée via ${widget.provider} à l'arrivée du livreur.",
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppTheme.textMuted, fontSize: 16, height: 1.5),
          ),
          const SizedBox(height: 40),
          if (isAuthenticating)
            const CircularProgressIndicator(color: AppTheme.primary)
          else
            Column(
              children: [
                const Text(
                  'Prêt pour livraison ?',
                  style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary),
                ),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      SharedDatabaseService().addLog('PAIEMENT', 'Le client initie le paiement de ${widget.amount + 500} FCFA via ${widget.provider}');
                      setState(() => isAuthenticating = true);
                      Future.delayed(const Duration(seconds: 1), widget.onSuccess);
                    },
                    child: const Text('CONFIRMER MA COMMANDE'),
                  ),
                ),
              ],
            ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
