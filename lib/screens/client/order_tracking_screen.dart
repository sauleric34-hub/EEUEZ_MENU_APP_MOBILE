import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/localization_service.dart';
import '../../services/shared_database_service.dart';

class OrderTrackingScreen extends StatelessWidget {
  final String orderId;
  const OrderTrackingScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: SharedDatabaseService(),
      builder: (context, _) {
        final order = SharedDatabaseService().orders.firstWhere(
              (o) => o['id'] == orderId,
              orElse: () => {},
            );

        if (order.isEmpty) return const Scaffold(body: Center(child: CircularProgressIndicator()));

        final status = order['status'];
        final delivererProfile = order['deliverer'];

        return Scaffold(
          backgroundColor: AppTheme.background,
          appBar: AppBar(
            title: Text(t('view_tracking').toUpperCase(),
                style: const TextStyle(letterSpacing: 1, fontSize: 13, fontWeight: FontWeight.bold)),
            centerTitle: true,
          ),
          body: Column(
            children: [
              _buildMapSimulation(status),
              Expanded(
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppTheme.paddingHuge),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(40)),
                  ),
                  child: Column(
                    children: [
                      _buildStatusHeader(status),
                      const SizedBox(height: 40),
                      if (delivererProfile != null) _buildDelivererCard(delivererProfile, status),
                      if (delivererProfile == null)
                        _buildWaitingState(),
                      const Spacer(),
                      _buildActionButtons(context, status),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMapSimulation(String status) {
    final db = SharedDatabaseService();
    // Simulation de coordonnées (Douala)
    // Utilisateur au centre : 4.0510, 9.7010
    double userX = 150; 
    double userY = 150;

    // Position du livreur
    double delivererX = 150 + (db.delivererLng - 9.7010) * 20000;
    double delivererY = 150 - (db.delivererLat - 4.0510) * 20000;

    return Container(
      height: 350,
      width: double.infinity,
      color: Colors.grey[200],
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Carte simulée
          Opacity(
            opacity: 0.6,
            child: Image.network(
              'https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/9.701,4.051,14/800x600?access_token=pk.xxx',
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _buildFakeGrid(),
            ),
          ),
          
          // Ma position (Client)
          const Center(
            child: Icon(Icons.person_pin_circle_rounded, color: Colors.blue, size: 45),
          ),
          
          // Animation de recherche
          if (status == 'SEARCHING')
            const Center(
              child: SizedBox(
                width: 200,
                height: 200,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.blueAccent),
                ),
              ),
            ),

          // Le Livreur Assigné/En route
          if (status != 'PENDING' && status != 'SEARCHING' && status != 'PAID')
            AnimatedPositioned(
              duration: const Duration(milliseconds: 1000),
              left: delivererX,
              top: delivererY,
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)]),
                    child: const Icon(Icons.delivery_dining_rounded, color: AppTheme.primary, size: 30),
                  ),
                  if (status == 'ASSIGNED')
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: AppTheme.accent, borderRadius: BorderRadius.circular(4)),
                      child: const Text('LIVREUR TROUVÉ', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFakeGrid() {
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 15),
      itemBuilder: (_, __) => Container(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.black.withOpacity(0.05)),
        ),
      ),
    );
  }

  List<Widget> _buildVirtualPoints() {
    return []; // Points virtuels maintenant gérés par la BD service
  }

  Widget _buildStatusHeader(String status) {
    String title = 'Préparation...';
    String sub = 'Votre restaurant prépare votre commande.';

    if (status == 'SEARCHING') {
      title = 'Recherche de Livreur...';
      sub = 'Nous trouvons le meilleur coursier pour vous.';
    } else if (status == 'ASSIGNED') {
      title = 'Livreur Assigné !';
      sub = 'Veuillez confirmer pour lancer la course.';
    } else if (status == 'WAITING_FOR_ACCEPTANCE') {
      title = 'En attente d\'acceptation';
      sub = 'Le livreur reçoit votre demande...';
    } else if (status == 'IN_TRANSIT') {
      title = 'Livreur en route !';
      sub = 'Votre commande arrive bientôt.';
    } else if (status == 'ARRIVED') {
      title = 'Livreur Arrivé !';
      sub = 'Rendez-vous au point de livraison.';
    } else if (status == 'COMPLETED') {
      title = 'Course Terminé';
      sub = 'Scannez le code QR pour payer.';
    } else if (status == 'PAID') {
      title = 'Merci !';
      sub = 'Votre commande a été réglée avec succès.';
    }

    return Column(
      children: [
        Container(
          width: 50, height: 5,
          margin: const EdgeInsets.only(bottom: 24),
          decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(10)),
        ),
        Text(title, textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.primary)),
        const SizedBox(height: 8),
        Text(sub, textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: AppTheme.textMuted)),
      ],
    );
  }

  Widget _buildDelivererCard(Map<String, dynamic> profile, String status) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.background,
        borderRadius: BorderRadius.circular(24),
        border: (status == 'ASSIGNED') ? Border.all(color: AppTheme.accent, width: 2) : null,
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: Image.network(profile['image'], width: 60, height: 60, fit: BoxFit.cover),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(profile['name'],
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppTheme.primary)),
                Text(profile['vehicle'], style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                Row(
                  children: [
                    const Icon(Icons.star_rounded, color: AppTheme.secondary, size: 14),
                    Text(' ${profile['rating']}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  ],
                ),
              ],
            ),
          ),
          if (status != 'ASSIGNED')
            IconButton(
              onPressed: () {},
              icon: const Icon(Icons.phone_rounded, color: AppTheme.primary),
              style: IconButton.styleFrom(backgroundColor: Colors.white),
            ),
        ],
      ),
    );
  }

  Widget _buildWaitingState() {
    return const SizedBox(height: 100, child: Center(child: CircularProgressIndicator(color: AppTheme.primary)));
  }

  Widget _buildActionButtons(BuildContext context, String status) {
    return Column(
      children: [
        if (status == 'ASSIGNED')
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => SharedDatabaseService().confirmDeliverer(orderId),
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accent, foregroundColor: Colors.white),
              child: const Text('CONFIRMER CE LIVREUR'),
            ),
          ),
        if (status == 'COMPLETED')
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => _showScanSimulation(context, orderId),
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.secondary, foregroundColor: AppTheme.primary),
              child: const Text('SCANNER & PAYER'),
            ),
          ),
        if (status == 'PAID' || status == 'PENDING')
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => Navigator.popUntil(context, (r) => r.isFirst),
              child: const Text('RETOUR À L\'ACCUEIL'),
            ),
          ),
      ],
    );
  }

  void _showScanSimulation(BuildContext context, String orderId) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(32),
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(40))),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Simulation Scan QR', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(border: Border.all(color: AppTheme.primary.withOpacity(0.1), width: 2), borderRadius: BorderRadius.circular(24)),
              child: const Icon(Icons.qr_code_scanner_rounded, size: 120, color: AppTheme.primary),
            ),
            const SizedBox(height: 32),
            const Text('Paiement en cours de validation...', textAlign: TextAlign.center),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  SharedDatabaseService().updateOrderStatus(orderId, 'PAID');
                  Navigator.pop(context);
                },
                child: const Text('CONFIRMER LE SCAN'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
