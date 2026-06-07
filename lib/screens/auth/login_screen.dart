import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/shared_database_service.dart';
import '../../services/localization_service.dart';
import '../../widgets/background_painter.dart';
import '../restaurant/restaurant_dashboard_screen.dart';
import '../client/client_home_screen.dart';
import '../deliverer/deliverer_home_screen.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passController = TextEditingController();
  
  String selectedPortal = 'client'; // client, merchant, delivery
  Map<String, dynamic>? selectedRestaurant;
  int step = 1; // Uniquement pour merchant

  void _handleLogin() {
    final db = SharedDatabaseService();
    bool success = false;

    if (selectedPortal == 'merchant') {
      if (selectedRestaurant == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Veuillez séléctionner un restaurant')),
        );
        return;
      }
      success = db.login(
        _emailController.text, 
        _passController.text, 
        restoId: selectedRestaurant!['id']
      );
    } else {
      // Pour client/delivery, login simplifié pour le test
      success = db.login(_emailController.text, _passController.text);
    }

    if (success) {
      Widget target;
      if (selectedPortal == 'merchant') {
        target = const RestaurantDashboardScreen();
      } else if (selectedPortal == 'delivery') {
        target = const DelivererHomeScreen();
      } else {
        target = const ClientHomeScreen();
      }

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => target),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Identifiants incorrects')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ThemedBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppTheme.paddingHuge),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 40),
                _buildHeader(),
                const SizedBox(height: 50),
                _buildPortalSelector(),
                const SizedBox(height: 40),
                if (selectedPortal == 'merchant' && step == 1)
                  _buildRestaurantSelection()
                else
                  _buildLoginForm(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: AppTheme.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Text(
            'CONNEXION',
            style: TextStyle(
              color: AppTheme.primary,
              fontWeight: FontWeight.bold,
              fontSize: 10,
              letterSpacing: 2,
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Bienvenue sur EZ',
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w900,
            color: AppTheme.primary,
          ),
        ),
        Text(
          'Votre portail vers l\'excellence culinaire',
          style: TextStyle(color: AppTheme.textMuted, fontSize: 16),
        ),
      ],
    );
  }

  Widget _buildPortalSelector() {
    return Row(
      children: [
        _portalButton('client', Icons.person_outline, 'Client'),
        const SizedBox(width: 12),
        _portalButton('merchant', Icons.store_outlined, 'Marchand'),
        const SizedBox(width: 12),
        _portalButton('delivery', Icons.delivery_dining_outlined, 'Livreur'),
      ],
    );
  }

  Widget _portalButton(String id, IconData icon, String label) {
    bool isSelected = selectedPortal == id;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          selectedPortal = id;
          step = 1;
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 20),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.primary : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? AppTheme.primary : Colors.grey.withOpacity(0.1),
            ),
            boxShadow: isSelected ? [
              BoxShadow(
                color: AppTheme.primary.withOpacity(0.3),
                blurRadius: 15,
                offset: const Offset(0, 8),
              )
            ] : [],
          ),
          child: Column(
            children: [
              Icon(icon, color: isSelected ? AppTheme.secondary : AppTheme.textMuted),
              const SizedBox(height: 8),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : AppTheme.textMuted,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRestaurantSelection() {
    final restos = SharedDatabaseService().restaurants;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Sélectionnez votre restaurant',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primary),
        ),
        const SizedBox(height: 16),
        ...restos.map((r) => _restaurantItem(r)).toList(),
      ],
    );
  }

  Widget _restaurantItem(Map<String, dynamic> r) {
    bool isSel = selectedRestaurant?['id'] == r['id'];
    return GestureDetector(
      onTap: () => setState(() {
        selectedRestaurant = r;
        step = 2;
      }),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: isSel ? AppTheme.accent : Colors.grey.withOpacity(0.1), width: 2),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(r['image'], width: 60, height: 60, fit: BoxFit.cover),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  Text(r['location'], style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppTheme.textMuted),
          ],
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    return Column(
      children: [
        if (selectedPortal == 'merchant')
          _backToRestoSelection(),
        _buildTextField('Email', Icons.email_outlined, _emailController),
        const SizedBox(height: 20),
        _buildTextField('Mot de passe', Icons.lock_outline, _passController, isObscure: true),
        const SizedBox(height: 40),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _handleLogin,
            child: const Text('SE CONNECTER'),
          ),
        const SizedBox(height: 20),
        TextButton(
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
          child: Text(
            'Pas encore de compte ? S\'inscrire',
            style: TextStyle(color: AppTheme.textMuted),
          ),
        ),
      ],
    );
  }

  Widget _backToRestoSelection() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: InkWell(
        onTap: () => setState(() => step = 1),
        child: Row(
          children: [
            const Icon(Icons.arrow_back_rounded, size: 16, color: AppTheme.accent),
            const SizedBox(width: 8),
            Text(
              'Changer de restaurant (${selectedRestaurant!['name']})',
              style: const TextStyle(color: AppTheme.accent, fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField(String label, IconData icon, TextEditingController controller, {bool isObscure = false}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 5))
        ],
      ),
      child: TextField(
        controller: controller,
        obscureText: isObscure,
        decoration: InputDecoration(
          hintText: label,
          prefixIcon: Icon(icon, color: AppTheme.primary, size: 20),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
          contentPadding: const EdgeInsets.all(24),
        ),
      ),
    );
  }
}
