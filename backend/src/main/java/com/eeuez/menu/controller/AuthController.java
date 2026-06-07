package com.eeuez.menu.controller;

import com.eeuez.menu.dto.*;
import com.eeuez.menu.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller d'authentification EEUEZ Menu.
 * Routes publiques — pas besoin de JWT.
 */
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * POST /api/auth/login
     * Body: { "email": "...", "password": "..." }
     *   OU { "telephone": "...", "password": "..." }
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            return ResponseEntity.ok(authService.login(request));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/register/client
     */
    @PostMapping("/register/client")
    public ResponseEntity<?> registerClient(@RequestBody RegisterClientRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(authService.registerClient(request));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/register/restaurant
     * Le restaurant est créé avec statut PENDING (en attente de validation admin).
     */
    @PostMapping("/register/restaurant")
    public ResponseEntity<?> registerRestaurant(@RequestBody RegisterRestaurantRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(authService.registerRestaurant(request));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/register/livreur
     */
    @PostMapping("/register/livreur")
    public ResponseEntity<?> registerLivreur(@RequestBody RegisterLivreurRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(authService.registerLivreur(request));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/google
     * Body: { "googleId": "...", "email": "...", "nom": "...", "prenom": "...", "avatar": "..." }
     */
    @PostMapping("/google")
    public ResponseEntity<?> loginWithGoogle(@RequestBody Map<String, String> googleData) {
        try {
            AuthResponse response = authService.loginWithGoogle(
                    googleData.get("googleId"),
                    googleData.get("email"),
                    googleData.get("nom"),
                    googleData.get("prenom"),
                    googleData.get("avatar")
            );
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("erreur", e.getMessage()));
        }
    }

    /**
     * GET /api/auth/ping — Vérification que l'API tourne.
     */
    @GetMapping("/ping")
    public ResponseEntity<Map<String, String>> ping() {
        return ResponseEntity.ok(Map.of(
                "statut", "OK",
                "app", "EEUEZ Menu Backend",
                "version", "1.0.0"
        ));
    }
}
