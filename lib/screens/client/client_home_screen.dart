import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/localization_service.dart';
import '../../services/shared_database_service.dart';
import 'restaurant_detail_screen.dart';
import 'order_tracking_screen.dart';
import '../../widgets/background_painter.dart';

class ClientHomeScreen extends StatelessWidget {
  const ClientHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        toolbarHeight: 80,
        backgroundColor: AppTheme.background,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Akwa, Douala 📍",
              style: TextStyle(fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.bold),
            ),
            const Text(
              "Bonjour, Ngochi 👋",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.primary),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: AppTheme.paddingLarge),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)],
              ),
              child: IconButton(
                onPressed: () {},
                icon: const Icon(Icons.notifications_none_rounded, color: AppTheme.primary),
              ),
            ),
          ),
        ],
      ),
      body: ThemedBackground(
        child: AnimatedBuilder(
          animation: SharedDatabaseService(),
          builder: (context, _) {
            final activeOrder = SharedDatabaseService().orders.firstWhere(
                  (o) => o['status'] != 'PAID',
                  orElse: () => {},
                );

            return SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (activeOrder.isNotEmpty) _buildActiveOrderBanner(context, activeOrder),
                  _buildHero(),
                  const SizedBox(height: 30),
                  _buildSearchBox(),
                  const SizedBox(height: 40),
                  _buildSectionHeader(t('popular_restos')),
                  const SizedBox(height: 20),
                  _buildRestaurantList(context),
                  const SizedBox(height: 100), // Bottom padding for FAB/Nav
                ],
              ),
            );
          },
        ),
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildHero() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.paddingLarge),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppTheme.paddingHuge),
        decoration: BoxDecoration(
          color: AppTheme.primary,
          borderRadius: BorderRadius.circular(32),
          image: DecorationImage(
            image: const NetworkImage('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=500'),
            fit: BoxFit.cover,
            colorFilter: ColorFilter.mode(AppTheme.primary.withOpacity(0.7), BlendMode.srcOver),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              t('welcome_msg'),
              style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, height: 1.2),
            ),
            const SizedBox(height: 12),
            Text(
              t('delivery_tag'),
              style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBox() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.paddingLarge),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        height: 65,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 20, offset: const Offset(0, 10)),
          ],
        ),
        child: Row(
          children: [
            const Icon(Icons.search_rounded, color: AppTheme.textMuted),
            const SizedBox(width: 15),
            Expanded(
              child: TextField(
                onChanged: (val) {
                  // Logique de filtrage ici
                },
                onSubmitted: (query) {
                  SharedDatabaseService().addLog('CLIENT', 'L\'utilisateur a recherché : "$query"');
                },
                decoration: InputDecoration(
                  hintText: t('search_hint'),
                  border: InputBorder.none,
                  hintStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 15),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppTheme.secondary.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.tune_rounded, color: AppTheme.primary, size: 20),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.paddingLarge),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.primary)),
          TextButton(
            onPressed: () {},
            child: Text(t('see_all'), style: const TextStyle(color: AppTheme.secondary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildRestaurantList(BuildContext context) {
    return ListView(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.paddingLarge),
      children: [
        _buildRestaurantCard(
          context,
          name: 'Chez Tante Marie',
          category: 'Traditionnelle • Grillades',
          rating: '4.8',
          time: '20-35 min',
          price: '500 FCFA',
          isCertified: true,
          imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=500',
        ),
        const SizedBox(height: 24),
        _buildRestaurantCard(
          context,
          name: 'Le Gourmet Du 237',
          category: 'Burger • Africain Fusion',
          rating: '4.5',
          time: '25-40 min',
          price: '700 FCFA',
          isCertified: false,
          imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445?auto=format&fit=crop&q=80&w=500',
        ),
      ],
    );
  }

  Widget _buildRestaurantCard(BuildContext context, {
    required String name,
    required String category,
    required String rating,
    required String time,
    required String price,
    required bool isCertified,
    required String imageUrl,
  }) {
    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => RestaurantDetailScreen(restaurantName: name))),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(30),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20, offset: const Offset(0, 5))],
        ),
        child: Column(
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
                  child: Image.network(imageUrl, height: 180, width: double.infinity, fit: BoxFit.cover),
                ),
                if (isCertified)
                  Positioned(
                    top: 15,
                    left: 15,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(50)),
                      child: Row(
                        children: [
                          const Icon(Icons.verified_rounded, color: AppTheme.secondary, size: 14),
                          const SizedBox(width: 5),
                          Text(t('certified'), style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                Positioned(
                  bottom: 15,
                  right: 15,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(15)),
                    child: Row(
                      children: [
                        const Icon(Icons.star_rounded, color: AppTheme.secondary, size: 16),
                        const SizedBox(width: 4),
                        Text(rating, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(AppTheme.paddingLarge),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.primary)),
                  const SizedBox(height: 4),
                  Text(category, style: const TextStyle(color: AppTheme.textMuted, fontSize: 13)),
                  const SizedBox(height: 15),
                  Row(
                    children: [
                      Icon(Icons.timer_outlined, size: 16, color: AppTheme.textMuted),
                      const SizedBox(width: 4),
                      Text(time, style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                      const SizedBox(width: 20),
                      Icon(Icons.delivery_dining_rounded, size: 16, color: AppTheme.secondary),
                      const SizedBox(width: 4),
                      Text(price, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primary)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20)],
      ),
      child: SafeArea(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _navItem(Icons.home_rounded, t('home'), true),
            _navItem(Icons.receipt_long_rounded, t('orders'), false),
            _navItem(Icons.favorite_rounded, t('favorites'), false),
            _navItem(Icons.person_outline_rounded, t('profile'), false),
          ],
        ),
      ),
    );
  }

  Widget _navItem(IconData icon, String label, bool isActive) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: isActive ? AppTheme.primary : AppTheme.textMuted, size: 26),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(color: isActive ? AppTheme.primary : AppTheme.textMuted, fontSize: 10, fontWeight: isActive ? FontWeight.bold : FontWeight.normal)),
      ],
    );
  }

  Widget _buildActiveOrderBanner(BuildContext context, Map<String, dynamic> order) {
    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => OrderTrackingScreen(orderId: order['id']))),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: AppTheme.paddingLarge, vertical: 20),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        decoration: BoxDecoration(
          color: AppTheme.secondary,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: AppTheme.secondary.withOpacity(0.3), blurRadius: 15, offset: const Offset(0, 5))],
        ),
        child: Row(
          children: [
            const Icon(Icons.delivery_dining_rounded, color: AppTheme.primary),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t('active_trip'), style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.primary, fontSize: 13)),
                  Text(t('status_${order['status'].toLowerCase()}'), style: const TextStyle(color: AppTheme.primary, fontSize: 11)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppTheme.primary),
          ],
        ),
      ),
    );
  }
}
