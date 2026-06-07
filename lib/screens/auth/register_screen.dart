import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../widgets/background_painter.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.primary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ThemedBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppTheme.paddingHuge),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Créer un compte',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.primary,
                  ),
                ),
                Text(
                  'Rejoignez l\'aventure EZ dès maintenant',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 16),
                ),
                const SizedBox(height: 50),
                _buildTextField('Nom complet', Icons.person_outline, _nameController),
                const SizedBox(height: 20),
                _buildTextField('Email', Icons.email_outlined, _emailController),
                const SizedBox(height: 20),
                _buildTextField('Mot de passe', Icons.lock_outline, _passController, isObscure: true),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Inscription réussie ! Vous pouvez vous connecter.')),
                      );
                      Navigator.pop(context);
                    },
                    child: const Text('S\'INSCRIRE'),
                  ),
                ),
              ],
            ),
          ),
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
