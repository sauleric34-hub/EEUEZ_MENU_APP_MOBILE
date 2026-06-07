import '../theme/app_theme.dart';
import '../widgets/background_painter.dart';
import '../services/shared_database_service.dart';

class SupportScreen extends StatelessWidget {
  final String title;
  final String description;
  final List<Widget> children;

  const SupportScreen({
    super.key,
    required this.title,
    required this.description,
    this.children = const [],
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text(title.toUpperCase(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
      ),
      body: ThemedBackground(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTheme.paddingLarge),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppTheme.primary)),
              const SizedBox(height: 8),
              Text(description, style: TextStyle(color: AppTheme.textMuted, fontSize: 14)),
              const SizedBox(height: 30),
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}

// 1. Signalement d'infraction
class ReportInfractionScreen extends StatelessWidget {
  const ReportInfractionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SupportScreen(
      title: 'Signalement',
      description: 'Signalez tout comportement inapproprié ou déviance constatée.',
      children: [
        _buildInputField('Type d\'infraction', 'Ex: Retard, Comportement, etc.'),
        const SizedBox(height: 16),
        _buildInputField('Description détaillée', 'Expliquez ce qui s\'est passé...', maxLines: 5),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () {
            SharedDatabaseService().addLog('SIGNALEMENT', 'Un utilisateur a envoyé un signalement d\'infraction');
            Navigator.pop(context);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.danger,
            minimumSize: const Size(double.infinity, 56),
          ),
          child: const Text('ENVOYER LE SIGNALEMENT', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}

// 2. Recrutement
class RecruitmentScreen extends StatelessWidget {
  const RecruitmentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SupportScreen(
      title: 'Nous Rejoindre',
      description: 'Devenez membre de la famille EEUEZ Menu.',
      children: [
        _infoCard(Icons.work_rounded, 'Livreur Partenaire', 'Gagnez de l\'argent en livrant des repas dans votre ville.'),
        _infoCard(Icons.restaurant_rounded, 'Restaurant Partenaire', 'Augmentez votre visibilité et vos revenus.'),
        const SizedBox(height: 24),
        _buildInputField('Votre Nom', 'Nom complet'),
        const SizedBox(height: 12),
        _buildInputField('Téléphone', '+237 ...'),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () {
            SharedDatabaseService().addLog('RECRUTEMENT', 'Une nouvelle candidature a été soumise via l\'interface Recrutement');
            Navigator.pop(context);
          },
          child: const Text('POSTULER MAINTENANT'),
        ),
      ],
    );
  }
}

// 3. Soutien et Dons
class DonationScreen extends StatelessWidget {
  const DonationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SupportScreen(
      title: 'Soutien & Dons',
      description: 'Soutenez les initiatives locales et sociales portées par EEUEZ.',
      children: [
        const Text('Montant du don', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: ['500', '1000', '5000', 'Autre'].map((amt) => _amountChip(amt)).toList(),
        ),
        const SizedBox(height: 30),
        _infoCard(Icons.favorite_rounded, 'Impact local', 'Vos dons servent à financer la formation des jeunes livreurs.'),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () {
            SharedDatabaseService().addLog('PAIEMENT', 'Un utilisateur a effectué un don de soutien à la plateforme');
            Navigator.pop(context);
          },
          child: const Text('CONFIRMER MON SOUTIEN'),
        ),
      ],
    );
  }

  Widget _amountChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.primary.withOpacity(0.1))),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
    );
  }
}

// 4. Forum & Suggestions
class ForumScreen extends StatelessWidget {
  final bool isSuggestion;
  const ForumScreen({super.key, this.isSuggestion = false});

  @override
  Widget build(BuildContext context) {
    return SupportScreen(
      title: isSuggestion ? 'Suggestions' : 'Forum Employés',
      description: isSuggestion 
        ? 'Partagez vos idées pour améliorer l\'application.' 
        : 'Espace d\'échange dédié aux membres du personnel.',
      children: [
        _forumPost('Jean P.', 'Une idée pour optimiser les trajets le matin...', 'Il serait bien de pouvoir...', 12),
        _forumPost('Marie L.', 'Problème de connexion Akwa', 'Est-ce que d\'autres ont des soucis ?', 5),
        const SizedBox(height: 30),
        FloatingActionButton.extended(
          onPressed: () {
            SharedDatabaseService().addLog(isSuggestion ? 'SUGGESTION' : 'FORUM', 'Nouvelle publication créée : ${isSuggestion ? 'Suggestion' : 'Post Forum'}');
          },
          label: Text(isSuggestion ? 'Nouvelle Suggestion' : 'Nouveau Post'),
          icon: const Icon(Icons.add),
          backgroundColor: AppTheme.secondary,
        ),
      ],
    );
  }
}

// Widgets Helpers
Widget _buildInputField(String label, String hint, {int maxLines = 1}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
      const SizedBox(height: 8),
      TextField(
        maxLines: maxLines,
        decoration: InputDecoration(
          hintText: hint,
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        ),
      ),
    ],
  );
}

Widget _infoCard(IconData icon, String title, String subtitle) {
  return Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
    child: Row(
      children: [
        Icon(icon, color: AppTheme.primary),
        const SizedBox(width: 16),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
            Text(subtitle, style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          ]),
        ),
      ],
    ),
  );
}

Widget _forumPost(String author, String title, String content, int replies) {
  return Container(
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            CircleAvatar(radius: 12, backgroundColor: AppTheme.primary.withOpacity(0.1), child: Text(author[0])),
            const SizedBox(width: 8),
            Text(author, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 12),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.primary)),
        const SizedBox(height: 4),
        Text(content, style: TextStyle(color: AppTheme.textMuted, fontSize: 12), maxLines: 2),
        const SizedBox(height: 12),
        Row(children: [
          Icon(Icons.comment_outlined, size: 14, color: AppTheme.textMuted),
          const SizedBox(width: 4),
          Text('$replies réponses', style: TextStyle(fontSize: 10, color: AppTheme.textMuted)),
        ]),
      ],
    ),
  );
}
