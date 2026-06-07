import 'dart:async';
import 'dart:convert';
import 'dart:js' as js;
import 'package:flutter/foundation.dart';

/// A simplified shared database simulation to coordinate the 3 portals.
class SharedDatabaseService extends ChangeNotifier {
  static final SharedDatabaseService _instance = SharedDatabaseService._internal();
  factory SharedDatabaseService() => _instance;

  // Order Statuses: 
  // PENDING -> SEARCHING -> ASSIGNED -> WAITING_FOR_ACCEPTANCE -> IN_TRANSIT -> ARRIVED -> COMPLETED -> PAID

  // State
  List<Map<String, dynamic>> _orders = [];
  bool _isLivreurOnline = true; 
  Map<String, dynamic>? _currentUser;
  String? _selectedRestaurantId;

  // Mock Restaurants
  final List<Map<String, dynamic>> _restaurants = [
    {'id': 'REST1', 'name': 'Chez Tante Marie', 'location': 'Akwa', 'image': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=200'},
    {'id': 'REST2', 'name': 'Le Buffet Camerounais', 'location': 'Bonapriso', 'image': 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&q=80&w=200'},
    {'id': 'REST3', 'name': 'Saveurs de Douala', 'location': 'Deido', 'image': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200'},
  ];

  // Mock Users with Roles
  final List<Map<String, dynamic>> _users = [
    {'email': 'admin@eeuez.com', 'pass': '1234', 'name': 'Admin Global', 'role': 'ADMIN', 'restoId': 'REST1'},
    {'email': 'admin2@eeuez.com', 'pass': '1234', 'name': 'Admin Secondaire', 'role': 'ADMIN', 'restoId': 'REST1'},
    {'email': 'rh1@eeuez.com', 'pass': '1234', 'name': 'Marie RH', 'role': 'RH', 'restoId': 'REST1'},
    {'email': 'rh2@eeuez.com', 'pass': '1234', 'name': 'Paul RH', 'role': 'RH', 'restoId': 'REST1'},
    {'email': 'chef1@eeuez.com', 'pass': '1234', 'name': 'Chef Jacques', 'role': 'ORDERS', 'restoId': 'REST1'},
    {'email': 'chef2@eeuez.com', 'pass': '1234', 'name': 'Chef Aline', 'role': 'ORDERS', 'restoId': 'REST1'},
  ];
  
  // Real-time Simulation: Virtual Deliverers
  final List<Map<String, dynamic>> _virtualDeliverers = [
    {'name': 'Moussa Expert', 'lat': 4.0520, 'lng': 9.7020, 'rating': 4.9, 'trips': 1250, 'vehicle': 'Moto Blue 237', 'image': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200'},
    {'name': 'Jean Rapide', 'lat': 4.0490, 'lng': 9.6990, 'rating': 4.7, 'trips': 850, 'vehicle': 'Scooter Fast', 'image': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200'},
    {'name': 'Ali Flash', 'lat': 4.0530, 'lng': 9.7040, 'rating': 4.8, 'trips': 2100, 'vehicle': 'Velo Nitro', 'image': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200'},
  ];

  // Mock Deliverer Profile (le profil "connecté")
  late Map<String, dynamic> _currentDelivererProfile;

  SharedDatabaseService._internal() {
    // Choisir un profil au hasard pour la simulation au démarrage
    _currentDelivererProfile = _virtualDeliverers[DateTime.now().millisecond % _virtualDeliverers.length];
    _loadFromStorage();
    
    // Polling pour synchroniser entre onglets toutes les secondes
    Timer.periodic(const Duration(seconds: 1), (timer) {
      _loadFromStorage();
    });
  }

  List<Map<String, dynamic>> get orders => _orders;
  bool get isLivreurOnline => _isLivreurOnline;
  Map<String, dynamic>? get currentUser => _currentUser;
  List<Map<String, dynamic>> get staffMembers => _users.where((u) => u['restoId'] == _selectedRestaurantId).toList();
  List<Map<String, dynamic>> get restaurants => _restaurants;
  List<Map<String, dynamic>> get logs => _logs.reversed.toList();
  String? get selectedRestaurantId => _selectedRestaurantId;

  void addLog(String type, String description) {
    final log = {
      'timestamp': DateTime.now().toIso8601String(),
      'type': type,
      'description': description,
      'user': _currentUser?['name'] ?? 'Système',
      'email': _currentUser?['email'] ?? '',
    };
    _logs.add(log);
    _saveToStorage();
    notifyListeners();
  }

  // Auth Actions
  bool login(String email, String password, {String? restoId}) {
    final user = _users.firstWhere(
      (u) => u['email'] == email && u['pass'] == password && (restoId == null || u['restoId'] == restoId),
      orElse: () => {},
    );

    if (user.isNotEmpty) {
      _currentUser = Map<String, dynamic>.from(user);
      _selectedRestaurantId = restoId;
      addLog('CONNEXION', 'Utilisateur connecté avec succès');
      _saveToStorage();
      notifyListeners();
      return true;
    }
    addLog('AUTH_FAIL', 'Tentative de connexion échouée pour $email');
    return false;
  }

  void logout() {
    addLog('DECONNEXION', 'L\'utilisateur s\'est déconnecté');
    _currentUser = null;
    _selectedRestaurantId = null;
    _saveToStorage();
    notifyListeners();
  }

  // HR Actions (RH logic)
  void addUser(Map<String, dynamic> newUser) {
    _users.add(newUser);
    addLog('GESTION_RH', 'Ajout de l\'utilisateur ${newUser['name']} (${newUser['role']})');
    notifyListeners();
  }

  void deleteUser(String email) {
    final userToDelete = _users.firstWhere((u) => u['email'] == email, orElse: () => {});
    _users.removeWhere((u) => u['email'] == email);
    if (userToDelete.isNotEmpty) {
      addLog('GESTION_RH', 'Suppression de l\'utilisateur ${userToDelete['name']}');
    }
    notifyListeners();
  }

  Map<String, dynamic>? _selectedDeliverer;
  double _delivererLat = 0.0;
  double _delivererLng = 0.0;

  Map<String, dynamic> get delivererProfile => _selectedDeliverer ?? _currentDelivererProfile;
  double get delivererLat => _delivererLat;
  double get delivererLng => _delivererLng;

  // Persistence helpers
  void _saveToStorage() {
    if (!kIsWeb) return;
    try {
      final data = json.encode({
        'orders': _orders,
        'isOnline': _isLivreurOnline,
        'profileName': _currentDelivererProfile['name'],
        'user': _currentUser,
        'restoId': _selectedRestaurantId,
        'logs': _logs,
      });
      js.context['localStorage'].callMethod('setItem', ['eeuez_db', data]);
    } catch (e) {
      debugPrint('Storage not available: $e');
    }
  }

  void _loadFromStorage() {
    if (!kIsWeb) return;
    try {
      final String? data = js.context['localStorage'].callMethod('getItem', ['eeuez_db']);
      if (data != null) {
        final decoded = json.decode(data);
        final List<Map<String, dynamic>> newOrders = List<Map<String, dynamic>>.from(
          (decoded['orders'] as List).map((o) => Map<String, dynamic>.from(o))
        );
        
        _currentUser = decoded['user'];
        _selectedRestaurantId = decoded['restoId'];
        
        if (decoded['logs'] != null) {
          _logs.clear();
          _logs.addAll(List<Map<String, dynamic>>.from(decoded['logs']));
        }
        
        bool hasChanged = false;
        
        final String? savedProfileName = decoded['profileName'];
        if (savedProfileName != null && savedProfileName != _currentDelivererProfile['name']) {
           final matchedProfile = _virtualDeliverers.firstWhere((p) => p['name'] == savedProfileName, orElse: () => _virtualDeliverers[0]);
           _currentDelivererProfile = matchedProfile;
           hasChanged = true;
        }

        // On ne notifie que si les données ont changé pour éviter les boucles
        if (hasChanged || json.encode(newOrders) != json.encode(_orders) || decoded['isOnline'] != _isLivreurOnline) {
          _orders = newOrders;
          _isLivreurOnline = decoded['isOnline'] ?? true;
          notifyListeners();
        }
      } else {
        // Premier lancement : on sauvegarde notre profil randomisé
        _saveToStorage();
      }
    } catch (e) {
      // Storage not available or corrupted
    }
  }

  // Actions
  void createOrder(Map<String, dynamic> order) {
    final newOrder = {
      ...order,
      'status': 'PENDING',
      'id': order['id'] ?? 'EEU-${DateTime.now().millisecondsSinceEpoch}',
      'deliverer': null,
      'clientName': 'Client Premium EEUEZ', // Information ajoutée pour le livreur
    };
    _orders.add(newOrder);
    addLog('COMMANDE', 'Nouvelle commande créée : ${newOrder['id']}');
    _saveToStorage();
    notifyListeners();
    
    // Auto-start searching
    searchForDeliverer(newOrder['id']);
  }

  void searchForDeliverer(String orderId) async {
    final index = _orders.indexWhere((o) => o['id'] == orderId);
    if (index == -1) return;

    _orders[index]['status'] = 'SEARCHING';
    _saveToStorage();
    notifyListeners();

    // Boucle de recherche : ne s'arrête que si un livreur est en ligne
    bool found = false;
    while (!found) {
      await Future.delayed(const Duration(seconds: 2));
      
      // Recharger l'état depuis le stockage pour voir si un livreur s'est connecté
      _loadFromStorage();
      
      if (_isLivreurOnline) {
        final updatedIndex = _orders.indexWhere((o) => o['id'] == orderId);
        if (updatedIndex == -1) return; // Commande annulée ou autre

        // Utilisation du livreur "connecté" trouvé via localStorage
        _selectedDeliverer = _currentDelivererProfile;
        
        // Placer à proximité (simulé par les coordonnées du profil choisi)
        _delivererLat = _selectedDeliverer!['lat'];
        _delivererLng = _selectedDeliverer!['lng'];

        _orders[updatedIndex]['status'] = 'ASSIGNED';
        _orders[updatedIndex]['deliverer'] = _selectedDeliverer;
        addLog('LIVRAISON', 'Livreur ${_selectedDeliverer!['name']} assigné à la commande $orderId');
        _saveToStorage();
        notifyListeners();
        found = true;
      } else {
        debugPrint('Recherche en cours... Aucun livreur en ligne.');
      }
    }
  }

  void confirmDeliverer(String orderId) {
    final index = _orders.indexWhere((o) => o['id'] == orderId);
    if (index != -1) {
      _orders[index]['status'] = 'WAITING_FOR_ACCEPTANCE';
      _saveToStorage();
      notifyListeners();
    }
  }

  void acceptOrder(String orderId) {
    final index = _orders.indexWhere((o) => o['id'] == orderId);
    if (index != -1) {
      // Synchronisation : on adopte le profil assigné par le client pour le test
      if (_orders[index]['deliverer'] != null) {
        _currentDelivererProfile = Map<String, dynamic>.from(_orders[index]['deliverer']);
        _selectedDeliverer = _currentDelivererProfile;
      }
      
      
      _orders[index]['status'] = 'IN_TRANSIT';
      addLog('LIVRAISON', 'Le livreur a accepté la commande $orderId et commence la course');
      _saveToStorage();
      _simulateMovement(orderId);
      notifyListeners();
    }
  }

  void rejectOrder(String orderId) {
    final index = _orders.indexWhere((o) => o['id'] == orderId);
    if (index != -1) {
      _selectedDeliverer = null;
      _orders[index]['deliverer'] = null;
      _saveToStorage();
      searchForDeliverer(orderId); // Relancer la recherche
    }
  }

  void updateOrderStatus(String orderId, String status) {
    final index = _orders.indexWhere((o) => o['id'] == orderId);
    if (index != -1) {
      final oldStatus = _orders[index]['status'];
      _orders[index]['status'] = status;
      addLog('COMMANDE', 'Commande $orderId : statut passé de $oldStatus à $status');
      
      // Cas particuliers demandés dans l'audio
      if (status == 'ARRIVED') addLog('LIVRAISON', 'Le livreur est arrivé à destination ($orderId)');
      if (status == 'PAID') addLog('PAIEMENT', 'Paiement effectué pour la commande $orderId');
      
      _saveToStorage();
      if (status == 'IN_TRANSIT') {
        _simulateMovement(orderId);
      }
      notifyListeners();
    }
  }

  void _simulateMovement(String orderId) {
    // Target: 4.0510, 9.7010 (Position de l'utilisateur simulée)
    double targetLat = 4.0510;
    double targetLng = 9.7010;

    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      final index = _orders.indexWhere((o) => o['id'] == orderId);
      if (index == -1 || _orders[index]['status'] != 'IN_TRANSIT') return false;

      // Déplacement progressif
      _delivererLat += (targetLat - _delivererLat) * 0.2;
      _delivererLng += (targetLng - _delivererLng) * 0.2;

      if ((_delivererLat - targetLat).abs() < 0.0001 && (_delivererLng - targetLng).abs() < 0.0001) {
        updateOrderStatus(orderId, 'ARRIVED');
        return false;
      }

      _saveToStorage();
      notifyListeners();
      return true;
    });
  }

  void toggleLivreurStatus(bool online) {
    _isLivreurOnline = online;
    _saveToStorage();
    notifyListeners();
  }
}
