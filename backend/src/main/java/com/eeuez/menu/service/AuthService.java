package com.eeuez.menu.service;

import com.eeuez.menu.dto.*;
import com.eeuez.menu.model.*;
import com.eeuez.menu.repository.*;
import com.eeuez.menu.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service d'authentification EEUEZ Menu.
 * Gère l'inscription et la connexion pour les 3 rôles.
 */
@Service
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final LivreurRepository livreurRepository;
    private final RestaurantRepository restaurantRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(
            UserRepository userRepository,
            ClientRepository clientRepository,
            LivreurRepository livreurRepository,
            RestaurantRepository restaurantRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil
    ) {
        this.userRepository = userRepository;
        this.clientRepository = clientRepository;
        this.livreurRepository = livreurRepository;
        this.restaurantRepository = restaurantRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    // ─── CONNEXION ────────────────────────────────────────────────

    public AuthResponse login(LoginRequest request) {
        User user = null;

        // Cherche par email ou téléphone
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            user = userRepository.findByEmail(request.getEmail())
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        } else if (request.getTelephone() != null && !request.getTelephone().isBlank()) {
            user = userRepository.findByTelephone(request.getTelephone())
                    .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        } else {
            throw new RuntimeException("Email ou téléphone requis");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Mot de passe incorrect");
        }

        if (!user.isActive()) {
            throw new RuntimeException("Compte désactivé. Contactez le support EEUEZ.");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole());
        return new AuthResponse(token, user);
    }

    // ─── INSCRIPTION CLIENT ───────────────────────────────────────

    public AuthResponse registerClient(RegisterClientRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Cet email est déjà utilisé");
        }
        if (request.getTelephone() != null && userRepository.existsByTelephone(request.getTelephone())) {
            throw new RuntimeException("Ce numéro est déjà utilisé");
        }

        Client client = new Client(
                request.getNom(),
                request.getPrenom(),
                request.getEmail(),
                request.getTelephone(),
                passwordEncoder.encode(request.getPassword())
        );

        Client saved = clientRepository.save(client);
        String token = jwtUtil.generateToken(saved.getId(), saved.getEmail(), saved.getRole());
        return new AuthResponse(token, saved);
    }

    // ─── INSCRIPTION RESTAURANT ───────────────────────────────────

    public AuthResponse registerRestaurant(RegisterRestaurantRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Cet email est déjà utilisé");
        }

        Restaurant restaurant = new Restaurant(
                request.getNom(),
                request.getPrenom(),
                request.getEmail(),
                request.getTelephone(),
                passwordEncoder.encode(request.getPassword()),
                request.getNomEtablissement(),
                request.getCategorie()
        );

        if (request.getDescription() != null) {
            restaurant.setDescription(request.getDescription());
        }
        if (request.getLatitude() != null) {
            restaurant.setLatitude(request.getLatitude());
            restaurant.setLongitude(request.getLongitude());
        }

        // Créer l'adresse si ville/quartier fournis
        if (request.getVille() != null) {
            Adresse adresse = new Adresse();
            adresse.setVille(request.getVille());
            adresse.setQuartier(request.getQuartier() != null ? request.getQuartier() : "");
            adresse.setLibelle("Principal");
            adresse.setLatitude(request.getLatitude());
            adresse.setLongitude(request.getLongitude());
            restaurant.setAdresse(adresse);
        }

        // Créer les horaires par défaut (lundi-dimanche)
        String[] jours = {"lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"};
        for (String jour : jours) {
            Horaire h = new Horaire();
            h.setRestaurant(restaurant);
            h.setJour(jour);
            h.setOuverture("08:00");
            h.setFermeture("22:00");
            h.setFerme(jour.equals("dimanche"));
            restaurant.getHoraires().add(h);
        }

        Restaurant saved = restaurantRepository.save(restaurant);
        String token = jwtUtil.generateToken(saved.getId(), saved.getEmail(), saved.getRole());
        return new AuthResponse(token, saved);
    }

    // ─── INSCRIPTION LIVREUR ──────────────────────────────────────

    public AuthResponse registerLivreur(RegisterLivreurRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Cet email est déjà utilisé");
        }

        Livreur livreur = new Livreur(
                request.getNom(),
                request.getPrenom(),
                request.getEmail(),
                request.getTelephone(),
                passwordEncoder.encode(request.getPassword()),
                request.getVehiculeType() != null ? request.getVehiculeType() : "moto",
                request.getVehiculePlaque()
        );

        if (request.getVehiculeMarque() != null) {
            livreur.setVehiculeMarque(request.getVehiculeMarque());
        }

        Livreur saved = livreurRepository.save(livreur);
        String token = jwtUtil.generateToken(saved.getId(), saved.getEmail(), saved.getRole());
        return new AuthResponse(token, saved);
    }

    // ─── CONNEXION GOOGLE OAUTH ───────────────────────────────────

    public AuthResponse loginWithGoogle(String googleId, String email, String nom, String prenom, String avatar) {
        // Cherche par googleId ou email
        User user = userRepository.findByGoogleId(googleId)
                .orElseGet(() -> userRepository.findByEmail(email).orElse(null));

        if (user == null) {
            // Créer un nouveau client Google
            Client client = new Client();
            client.setNom(nom);
            client.setPrenom(prenom != null ? prenom : "");
            client.setEmail(email);
            client.setGoogleId(googleId);
            client.setAvatar(avatar);
            client.setPassword(passwordEncoder.encode(googleId + "_google_oauth"));
            client.setRole("CLIENT");
            user = clientRepository.save(client);
        } else if (user.getGoogleId() == null) {
            // Lier le compte existant à Google
            user.setGoogleId(googleId);
            if (avatar != null) user.setAvatar(avatar);
            user = userRepository.save(user);
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole());
        return new AuthResponse(token, user);
    }
}
