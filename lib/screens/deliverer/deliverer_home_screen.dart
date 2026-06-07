import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/localization_service.dart';
import '../../services/shared_database_service.dart';
import '../../widgets/background_painter.dart';

class DelivererHomeScreen extends StatefulWidget {
  const DelivererHomeScreen({super.key});

  @override
  State<DelivererHomeScreen> createState() => _DelivererHomeScreenState();
}

class _DelivererHomeScreenState extends State<DelivererHomeScreen> {
  bool isOnline = SharedDatabaseService().isLivreurOnline;

  void _toggleOnline(bool value) {
    setState(() {
      isOnline = value;
      SharedDatabaseService().toggleLivreurStatus(value);
    });
    SharedDatabaseService().addLog('LIVRAISON', 'Le livreur est désormais ${value ? 'EN LIGNE' : 'HORS LIGNE'}');
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: SharedDatabaseService(),
      builder: (context, _) {
        final currentProfile = SharedDatabaseService().delivererProfile;
        final activeTrip = SharedDatabaseService().orders.firstWhere(
              (o) => o['status'] != 'PENDING' && 
                     o['status'] != 'PAID' && 
                     o['deliverer'] != null && 
                     o['deliverer']['name'] == currentProfile['name'],
              orElse: () => {},
            );

        return Scaffold(
          backgroundColor: AppTheme.background,
          appBar: AppBar(
            title: Text(t('mode_delivery').toUpperCase(),
                style: const TextStyle(letterSpacing: 2, fontSize: 13, fontWeight: FontWeight.bold)),
            centerTitle: true,
            actions: [
              Transform.scale(
                scale: 0.8,
                child: Switch(
                  value: isOnline,
                  onChanged: _toggleOnline,
                  activeColor: AppTheme.accent,
                ),
              ),
              const SizedBox(width: 12),
            ],
          ),
          body: ThemedBackground(
            child: Column(
              children: [
                _buildDelivererHeader(),
                Expanded(
                  child: !isOnline
                      ? _buildOfflineState()
                      : _buildOnlineState(activeTrip),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDelivererHeader() {
    final profile = SharedDatabaseService().delivererProfile;
    return Container(
      padding: const EdgeInsets.all(AppTheme.paddingLarge),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0x10000000))),
      ),
      child: Row(
        children: [
          CircleAvatar(radius: 28, backgroundImage: NetworkImage(profile['image'])),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(profile['name'],
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppTheme.primary)),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: AppTheme.secondary, borderRadius: BorderRadius.circular(4)),
                      child: Text(t('expert'),
                          style: const TextStyle(color: AppTheme.primary, fontSize: 8, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
                Text('⭐ ${profile['rating']} • ${profile['trips']} courses',
                    style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
                color: isOnline ? AppTheme.accent.withOpacity(0.1) : AppTheme.danger.withOpacity(0.1),
                borderRadius: BorderRadius.circular(50)),
            child: Text(isOnline ? t('online') : t('offline'),
                style: TextStyle(
                    color: isOnline ? AppTheme.accent : AppTheme.danger,
                    fontWeight: FontWeight.bold,
                    fontSize: 10)),
          ),
        ],
      ),
    );
  }

  Widget _buildOfflineState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.paddingHuge),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.05), shape: BoxShape.circle),
              child: const Icon(Icons.delivery_dining_rounded, size: 80, color: AppTheme.primary),
            ),
            const SizedBox(height: 32),
            Text(t('offline_msg'),
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppTheme.primary)),
            const SizedBox(height: 12),
            Text(t('offline_sub'),
                textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textMuted, fontSize: 16)),
          ],
        ),
      ),
    );
  }

  Widget _buildOnlineState(Map<String, dynamic> activeTrip) {
    final currentProfile = SharedDatabaseService().delivererProfile;
    final orders = SharedDatabaseService().orders;
    final incomingRequest = orders.firstWhere(
      (o) => o['status'] == 'WAITING_FOR_ACCEPTANCE',
      orElse: () => {},
    );

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppTheme.paddingLarge),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (incomingRequest.isNotEmpty) ...[
            Text('DEMANDE ENTRANTE 🔔',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.accent)),
            const SizedBox(height: 20),
            _buildIncomingRequestCard(incomingRequest),
            const SizedBox(height: 40),
          ],
          
          if (activeTrip.isEmpty) ...[
            Text(t('available_trips'),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.primary)),
            const SizedBox(height: 20),
            Center(
              child: Column(
                children: [
                  const SizedBox(height: 40),
                  const CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                  const SizedBox(height: 20),
                  Text(t('waiting_for_trip'), style: TextStyle(color: AppTheme.textMuted)),
                ],
              ),
            ),
          ] else ...[
            Text(t('active_trip'),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.primary)),
            const SizedBox(height: 20),
            _buildActiveTripCard(activeTrip),
          ],
        ],
      ),
    );
  }

  Widget _buildIncomingRequestCard(Map<String, dynamic> order) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: AppTheme.accent, width: 2),
        boxShadow: [BoxShadow(color: AppTheme.accent.withOpacity(0.1), blurRadius: 20)],
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.shopping_bag_rounded, color: AppTheme.primary, size: 30),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(order['clientName'] ?? 'NOUVELLE COURSE', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                    Text(order['items'] ?? 'Destination : Douala, Akwa', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                  ],
                ),
              ),
              Text('${order['total']} ${t('currency')}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.accent)),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    SharedDatabaseService().addLog('LIVRAISON', 'Le livreur a REFUSÉ la commande ${order['id']}');
                    SharedDatabaseService().rejectOrder(order['id']);
                  },
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16), foregroundColor: AppTheme.danger),
                  child: const Text('REFUSER'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    SharedDatabaseService().addLog('LIVRAISON', 'Le livreur a ACCEPTÉ la commande ${order['id']}');
                    SharedDatabaseService().acceptOrder(order['id']);
                  },
                  style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16), backgroundColor: AppTheme.accent),
                  child: const Text('ACCEPTER'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTripCard(Map<String, dynamic> order) {
    return const SizedBox.shrink(); // Ancien widget remplacé par _buildOnlineState logic
  }

  Widget _buildActiveTripCard(Map<String, dynamic> trip) {
    final status = trip['status'];

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.primary,
        borderRadius: BorderRadius.circular(32),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const CircleAvatar(radius: 20, backgroundColor: Colors.white24, child: Icon(Icons.person, color: Colors.white)),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(trip['clientName'] ?? 'Client EEUEZ', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    const Text('Livraison Express', style: TextStyle(color: Colors.white70, fontSize: 12)),
                  ],
                ),
              ),
              if (status == 'IN_TRANSIT')
                const Icon(Icons.directions_bike_rounded, color: AppTheme.secondary),
            ],
          ),
          const SizedBox(height: 32),
          if (status == 'IN_TRANSIT')
            const Text('EN ROUTE...', style: TextStyle(color: AppTheme.secondary, fontWeight: FontWeight.w900, fontSize: 20)),
          if (status == 'ARRIVED')
             const Text('VOUS ÊTES ARRIVÉ !', style: TextStyle(color: AppTheme.accent, fontWeight: FontWeight.w900, fontSize: 20)),
          if (status == 'COMPLETED')
             const Text('COURSE TERMINÉE', style: TextStyle(color: AppTheme.secondary, fontWeight: FontWeight.w900, fontSize: 20)),
          
          const SizedBox(height: 32),
          if (status == 'IN_TRANSIT')
            _activeAction('MARQUER COMME ARRIVÉ', () {
              SharedDatabaseService().addLog('LIVRAISON', 'Le livreur a cliqué sur "ARRIVÉ" pour la commande ${trip['id']}');
              SharedDatabaseService().updateOrderStatus(trip['id'], 'ARRIVED');
            }, color: AppTheme.secondary),
          if (status == 'ARRIVED')
            _activeAction('TERMINER LA COURSE', () {
              SharedDatabaseService().addLog('LIVRAISON', 'Le livreur a cliqué sur "TERMINER LA COURSE" pour la commande ${trip['id']}');
              SharedDatabaseService().updateOrderStatus(trip['id'], 'COMPLETED');
            }, color: AppTheme.accent),
          if (status == 'COMPLETED')
             _activeAction('AFFICHER QR PAIEMENT', () {
               SharedDatabaseService().addLog('PAIEMENT', 'Le livreur affiche le QR Code de paiement pour la commande ${trip['id']}');
               _showPaymentQR(trip['id']);
             }, color: AppTheme.secondary),
          
          const SizedBox(height: 12),
          _activeAction('APPELER LE CLIENT', () {}, isOutlined: true),
        ],
      ),
    );
  }

  Widget _activeAction(String label, VoidCallback onTap, {Color? color, bool isOutlined = false}) {
    return SizedBox(
      width: double.infinity,
      child: isOutlined
          ? OutlinedButton(
              onPressed: onTap,
              style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white30),
                  padding: const EdgeInsets.symmetric(vertical: 18)),
              child: Text(label),
            )
          : ElevatedButton(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(
                  backgroundColor: color,
                  foregroundColor: AppTheme.primary,
                  padding: const EdgeInsets.symmetric(vertical: 18)),
              child: Text(label),
            ),
    );
  }

  void _showPaymentQR(String orderId) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(40))),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.black12, borderRadius: BorderRadius.circular(10))),
            const SizedBox(height: 40),
            Text(t('qr_msg'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.primary)),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                  border: Border.all(color: AppTheme.primary.withOpacity(0.1), width: 2),
                  borderRadius: BorderRadius.circular(30)),
              child: const Icon(Icons.qr_code_scanner_rounded, size: 180, color: AppTheme.primary),
            ),
            const SizedBox(height: 32),
            Text(t('qr_sub'),
                textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textMuted, fontSize: 14, height: 1.5)),
            const SizedBox(height: 40),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
              onPressed: () {
                  SharedDatabaseService().addLog('PAIEMENT', 'Validation finale du paiement pour la commande $orderId par le livreur');
                  SharedDatabaseService().updateOrderStatus(orderId, 'PAID');
                  Navigator.pop(context);
                },
                child: const Text('VALIDER LE PAIEMENT'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
