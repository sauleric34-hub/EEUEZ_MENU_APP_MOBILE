import '../../widgets/background_painter.dart';
import '../auth/login_screen.dart';
import '../support_screens.dart';

class RestaurantDashboardScreen extends StatefulWidget {
  const RestaurantDashboardScreen({super.key});

  @override
  State<RestaurantDashboardScreen> createState() => _RestaurantDashboardScreenState();
}

class _RestaurantDashboardScreenState extends State<RestaurantDashboardScreen> {
  int _activeTab = 0; // 0: Accueil/Commandes, 1: RH, 2: Journal, 3: Stats

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: SharedDatabaseService(),
      builder: (context, _) {
        final db = SharedDatabaseService();
        final user = db.currentUser;
        final role = user?['role'] ?? 'ORDERS';
        final allOrders = db.orders;

        return Scaffold(
          backgroundColor: AppTheme.background,
          appBar: AppBar(
            title: const Text('EZ MERCHANT', style: TextStyle(letterSpacing: 2, fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primary)),
            centerTitle: true,
            actions: [
              IconButton(
                onPressed: () {
                  db.logout();
                  Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
                }, 
                icon: const Icon(Icons.logout_rounded, color: AppTheme.danger)
              ),
              const SizedBox(width: 8),
            ],
          ),
          drawer: _buildDrawer(context, user),
          body: ThemedBackground(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildAdminHeader(user),
                  const SizedBox(height: 20),
                  _buildTabSwitcher(role),
                  const SizedBox(height: 20),
                  
                  if (_activeTab == 0) _buildOrderSection(context, allOrders),
                  if (_activeTab == 1 && (role == 'ADMIN' || role == 'RH')) _buildHRSection(context, db),
                  if (_activeTab == 2 && role == 'ADMIN') _buildTraceabilityJournal(db.logs),
                  if (_activeTab == 3 && role == 'ADMIN') _buildAdvancedStats(allOrders),
                  
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildTabSwitcher(String role) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.paddingLarge),
      child: Row(
        children: [
          _tabItem(0, 'Commandes', Icons.receipt_long_rounded),
          if (role == 'ADMIN' || role == 'RH') _tabItem(1, 'Équipe', Icons.people_rounded),
          if (role == 'ADMIN') ...[
            _tabItem(2, 'Journal', Icons.history_rounded),
            _tabItem(3, 'Stats', Icons.analytics_rounded),
          ],
        ],
      ),
    );
  }

  Widget _tabItem(int index, String label, IconData icon) {
    bool isSel = _activeTab == index;
    return GestureDetector(
      onTap: () => setState(() => _activeTab = index),
      child: Container(
        margin: const EdgeInsets.only(right: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isSel ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: isSel ? [BoxShadow(color: AppTheme.primary.withOpacity(0.2), blurRadius: 8)] : [],
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: isSel ? Colors.white : AppTheme.textMuted),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(color: isSel ? Colors.white : AppTheme.textMuted, fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _buildTraceabilityJournal(List<Map<String, dynamic>> logs) {
    return Padding(
      padding: const EdgeInsets.all(AppTheme.paddingLarge),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('JOURNAL DE TRAÇABILITÉ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.primary, letterSpacing: 1.2)),
          const SizedBox(height: 20),
          ...logs.map((log) => _logCard(log)).toList(),
        ],
      ),
    );
  }

  Widget _logCard(Map<String, dynamic> log) {
    final time = DateTime.parse(log['timestamp']);
    Color typeColor = Colors.grey;
    if (log['type'] == 'COMMANDE') typeColor = Colors.blue;
    if (log['type'] == 'PAIEMENT') typeColor = Colors.green;
    if (log['type'] == 'CONNEXION') typeColor = Colors.orange;
    if (log['type'] == 'GESTION_RH') typeColor = Colors.purple;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppTheme.primary.withOpacity(0.05))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: typeColor.withOpacity(0.1), shape: BoxShape.circle),
            child: Icon(_getLogIcon(log['type']), size: 16, color: typeColor),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(log['type'], style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: typeColor, letterSpacing: 1)),
                    Text('${time.hour}:${time.minute.toString().padLeft(2, '0')}', style: TextStyle(color: AppTheme.textMuted, fontSize: 10)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(log['description'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 2),
                Text('Par ${log['user']}', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _getLogIcon(String type) {
    switch (type) {
      case 'COMMANDE': return Icons.shopping_bag_rounded;
      case 'PAIEMENT': return Icons.payments_rounded;
      case 'CONNEXION': return Icons.login_rounded;
      case 'GESTION_RH': return Icons.manage_accounts_rounded;
      default: return Icons.info_rounded;
    }
  }

  Widget _buildAdvancedStats(List<Map<String, dynamic>> orders) {
    final totalRevenue = orders.where((o) => o['status'] == 'PAID').fold(0, (sum, o) => sum + (o['total'] ?? 0));
    final count = orders.length;
    final successRate = count == 0 ? 0 : (orders.where((o) => o['status'] == 'PAID').length / count * 100).toInt();

    return Padding(
      padding: const EdgeInsets.all(AppTheme.paddingLarge),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('STATISTIQUES AVANCÉES', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.primary, letterSpacing: 1.2)),
          const SizedBox(height: 20),
          _statWideCard('Recettes Totales', '$totalRevenue FCFA', Icons.account_balance_wallet_rounded, AppTheme.primary),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _statSmallCard('Commandes', '$count', Icons.receipt_long_rounded, Colors.orange)),
              const SizedBox(width: 12),
              Expanded(child: _statSmallCard('Succès', '$successRate%', Icons.check_circle_rounded, Colors.green)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statWideCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(24), boxShadow: [BoxShadow(color: color.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 6))]),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900)),
          ]),
          Icon(icon, color: Colors.white24, size: 40),
        ],
      ),
    );
  }

  Widget _statSmallCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppTheme.primary.withOpacity(0.05))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 12),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.primary)),
          Text(title, style: TextStyle(color: AppTheme.textMuted, fontSize: 10, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildAdminHeader(Map<String, dynamic>? user) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppTheme.paddingLarge),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.8),
        border: Border(bottom: BorderSide(color: AppTheme.primary.withOpacity(0.05))),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(3),
            decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
            child: const CircleAvatar(radius: 30, backgroundImage: NetworkImage('https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200')),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(user?['name'] ?? 'Utilisateur', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.primary)),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(4)),
                      child: Text(user?['role'] ?? 'STAFF', style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
                Text('Chez Tante Marie • Akwa', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHRSection(BuildContext context, SharedDatabaseService db) {
    final user = db.currentUser;
    final role = user?['role'] ?? 'ORDERS';
    final members = db.staffMembers;

    return Padding(
      padding: const EdgeInsets.all(AppTheme.paddingLarge),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('GESTION RH', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.primary, letterSpacing: 1.2)),
              if (role == 'ADMIN' || role == 'RH')
                IconButton(
                  onPressed: () {
                    // Simuler ajout : Admin peut tout ajouter, RH seulement ORDERS
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(role == 'ADMIN' ? 'Ajouter RH ou Staff' : 'Ajouter Staff Commandes')),
                    );
                  }, 
                  icon: const Icon(Icons.person_add_rounded, color: AppTheme.accent)
                ),
            ],
          ),
          const SizedBox(height: 16),
          ...members.map((m) {
            final targetRole = m['role'];
            bool canManage = false;
            
            if (role == 'ADMIN') {
              // Admin peut supprimer tout le monde sauf soi-même
              canManage = true;
              if (m['email'] == user!['email']) canManage = false; 
            } else if (role == 'RH') {
              // RH peut supprimer uniquement ORDERS
              if (targetRole == 'ORDERS') canManage = true;
            }

            IconData memberIcon = Icons.restaurant_menu_rounded;
            if (m['role'] == 'RH') memberIcon = Icons.people_alt_rounded;
            if (m['role'] == 'ADMIN') memberIcon = Icons.admin_panel_settings_rounded;

            return _hrCard(m['name'], targetRole, memberIcon, canManage);
          }).toList(),
        ],
      ),
    );
  }

  Widget _hrCard(String name, String role, IconData icon, bool canManage) {
    String roleLabel = 'Gestionnaire Commandes';
    if (role == 'RH') roleLabel = 'Ressources Humaines';
    if (role == 'ADMIN') roleLabel = 'Administrateur';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppTheme.primary.withOpacity(0.05))),
      child: Row(
        children: [
          Icon(icon, color: AppTheme.primary.withOpacity(0.5)),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
              Text(roleLabel, style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
            ]),
          ),
          if (canManage) ...[
            IconButton(onPressed: () {}, icon: const Icon(Icons.edit_note_rounded, color: AppTheme.primary)),
            IconButton(onPressed: () {}, icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.danger)),
          ],
        ],
      ),
    );
  }

  Widget _buildOrderSection(BuildContext context, List<Map<String, dynamic>> orders) {
    return Padding(
      padding: const EdgeInsets.all(AppTheme.paddingLarge),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('FLUX COMMANDES', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.primary, letterSpacing: 1.2)),
          const SizedBox(height: 20),
          if (orders.isEmpty)
            const Center(child: Padding(padding: EdgeInsets.all(40), child: Text('Aucune commande active')))
          else
            ...orders.map((o) => _orderCard(o)).toList(),
        ],
      ),
    );
  }

  Widget _orderCard(Map<String, dynamic> order) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: AppTheme.primary.withOpacity(0.05))),
      child: Row(
        children: [
          const Icon(Icons.receipt_long_rounded, color: AppTheme.secondary, size: 24),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(order['id'], style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
              Text(order['status'], style: const TextStyle(color: AppTheme.accent, fontSize: 10, fontWeight: FontWeight.bold)),
            ]),
          ),
          ElevatedButton(
            onPressed: () {
              SharedDatabaseService().addLog('COMMANDE', 'L\'employé a cliqué sur VALIDATION pour la commande ${order['id']}');
              SharedDatabaseService().updateOrderStatus(order['id'], 'ASSIGNED'); // Or next step
            }, 
            style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            child: const Text('VALIDER', style: TextStyle(fontSize: 10))
          ),
        ],
      ),
    );
  }


  Widget _buildDrawer(BuildContext context, Map<String, dynamic>? user) {
    return Drawer(
      backgroundColor: Colors.white,
      child: Column(
        children: [
          _drawerHeader(user),
          _drawerLink(context, Icons.report_problem_rounded, 'Signaler une infraction', const ReportInfractionScreen()),
          _drawerLink(context, Icons.work_outline_rounded, 'Recrutement', const RecruitmentScreen()),
          _drawerLink(context, Icons.favorite_border_rounded, 'Soutien & Dons', const DonationScreen()),
          _drawerLink(context, Icons.forum_outlined, 'Forum Employés', const ForumScreen()),
          _drawerLink(context, Icons.lightbulb_outline_rounded, 'Suggestions', const ForumScreen(isSuggestion: true)),
          const Spacer(),
          const Divider(),
          ListTile(leading: const Icon(Icons.info_outline_rounded), title: const Text('À propos'), onTap: () {}),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _drawerHeader(Map<String, dynamic>? user) {
    return DrawerHeader(
      decoration: const BoxDecoration(color: AppTheme.primary),
      child: Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.store_rounded, color: AppTheme.secondary, size: 50),
          const SizedBox(height: 10),
          Text(user?['name'] ?? 'Dashboard', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ]),
      ),
    );
  }

  Widget _drawerLink(BuildContext context, IconData icon, String title, Widget target) {
    return ListTile(
      leading: Icon(icon, color: AppTheme.primary, size: 20),
      title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
      onTap: () {
        Navigator.pop(context); // Close drawer
        Navigator.push(context, MaterialPageRoute(builder: (_) => target));
      },
    );
  }
}
