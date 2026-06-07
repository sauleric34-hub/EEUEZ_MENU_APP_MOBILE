package com.eeuez.menu.config;

import com.eeuez.menu.model.*;
import com.eeuez.menu.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Initialise la base de données avec des données de test au démarrage.
 * UNIQUEMENT en développement (H2).
 *
 * Crée :
 * - 1 Admin
 * - 3 Restaurants (avec menus, horaires)
 * - 2 Clients
 * - 1 Livreur
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final RestaurantRepository restaurantRepository;
    private final LivreurRepository livreurRepository;
    private final PlatRepository platRepository;
    private final CategorieRepository categorieRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(
            UserRepository userRepository,
            ClientRepository clientRepository,
            RestaurantRepository restaurantRepository,
            LivreurRepository livreurRepository,
            PlatRepository platRepository,
            CategorieRepository categorieRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.clientRepository = clientRepository;
        this.restaurantRepository = restaurantRepository;
        this.livreurRepository = livreurRepository;
        this.platRepository = platRepository;
        this.categorieRepository = categorieRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        // Ne pas réinitialiser si déjà peuplé
        if (userRepository.count() > 0) {
            System.out.println("✅ Base de données déjà initialisée — skip DataInitializer");
            return;
        }

        System.out.println("🌱 Initialisation des données de test...");

        // ─── RESTAURANTS ─────────────────────────────────────────────
        Restaurant phenix = creerRestaurant(
                "Kamga", "Jean-Baptiste", "jb@phenixdor.cm", "+237655123456",
                "Le Phénix d'Or", "camerounais", "Restaurant camerounais haut de gamme au cœur de Yaoundé.",
                3.8480, 11.5021, "Yaoundé", "Centre Ville"
        );

        Restaurant pizza = creerRestaurant(
                "Fouda", "Marie", "marie@pizzapalace.cm", "+237699234567",
                "Pizza Palace", "pizzeria", "La meilleure pizza de Douala.",
                4.0511, 9.7085, "Douala", "Akwa"
        );

        Restaurant mamaAfrica = creerRestaurant(
                "Mbaye", "Oumar", "oumar@mamaafrica.cm", "+237677345678",
                "Chez Mama Africa", "africain", "Cuisine africaine authentique, spécialités du terroir.",
                3.8672, 11.5213, "Yaoundé", "Bastos"
        );

        // ─── MENUS ────────────────────────────────────────────────────
        ajouterMenuPhenix(phenix);
        ajouterMenuPizza(pizza);

        // ─── CLIENTS ─────────────────────────────────────────────────
        Client sophie = new Client("Mbarga", "Sophie", "sophie@gmail.com", "+237699876543",
                passwordEncoder.encode("password123"));
        clientRepository.save(sophie);

        Client alain = new Client("Biyong", "Alain", "alain@gmail.com", "+237655432198",
                passwordEncoder.encode("password123"));
        clientRepository.save(alain);

        // ─── LIVREUR ─────────────────────────────────────────────────
        Livreur paul = new Livreur("Nkolo", "Paul", "paul@eeuez.cm", "+237677234567",
                passwordEncoder.encode("livreur123"), "moto", "YD-5678-A");
        paul.setVehiculeMarque("Yamaha");
        paul.setOnline(true);
        paul.setPositionLatitude(3.8550);
        paul.setPositionLongitude(11.5050);
        paul.setStatut("ACTIVE");
        paul.setNoteGlobale(4.7);
        paul.setNombreLivraisons(287);
        paul.setGainTotal(1250000.0);
        livreurRepository.save(paul);

        // ─── ADMIN ───────────────────────────────────────────────────
        User admin = new User();
        admin.setNom("Admin");
        admin.setPrenom("EEUEZ");
        admin.setEmail("admin@eeuez.cm");
        admin.setTelephone("+237600000001");
        admin.setPassword(passwordEncoder.encode("admin2024!"));
        admin.setRole("ADMIN");
        admin.setStatut("ACTIVE");
        userRepository.save(admin);

        System.out.println("✅ Données de test créées !");
        System.out.println("   👤 Admin    : admin@eeuez.cm / admin2024!");
        System.out.println("   🏪 Restaurant: jb@phenixdor.cm / password123");
        System.out.println("   🛍️  Client   : sophie@gmail.com / password123");
        System.out.println("   🛵 Livreur  : paul@eeuez.cm / livreur123");
    }

    private Restaurant creerRestaurant(
            String nom, String prenom, String email, String telephone,
            String nomEtab, String categorie, String description,
            double lat, double lon, String ville, String quartier
    ) {
        Restaurant r = new Restaurant(nom, prenom, email, telephone,
                passwordEncoder.encode("password123"), nomEtab, categorie);
        r.setDescription(description);
        r.setLatitude(lat);
        r.setLongitude(lon);
        r.setStatut("ACTIVE");
        r.setOuvert(true);
        r.setNoteGlobale(4.8);
        r.setNombreAvis(342);
        r.setTempsLivraisonMoyen(25);
        r.setFraisLivraison(500);

        Adresse adresse = new Adresse();
        adresse.setVille(ville);
        adresse.setQuartier(quartier);
        adresse.setLibelle("Principal");
        adresse.setLatitude(lat);
        adresse.setLongitude(lon);
        r.setAdresse(adresse);

        // Horaires par défaut
        String[] jours = {"lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"};
        for (String jour : jours) {
            Horaire h = new Horaire();
            h.setRestaurant(r);
            h.setJour(jour);
            h.setOuverture("08:00");
            h.setFermeture("22:00");
            h.setFerme(false);
            r.getHoraires().add(h);
        }

        return restaurantRepository.save(r);
    }

    private void ajouterMenuPhenix(Restaurant r) {
        // Catégorie Spécialités
        Categorie specialites = new Categorie();
        specialites.setRestaurant(r);
        specialites.setNom("Spécialités");
        specialites.setDescription("Nos plats signatures");
        specialites.setIcone("⭐");
        specialites.setOrdre(1);
        specialites = categorieRepository.save(specialites);
        r.getMenu().add(specialites);
        restaurantRepository.save(r);

        Plat pouletDG = new Plat();
        pouletDG.setRestaurant(r);
        pouletDG.setCategorie(specialites);
        pouletDG.setNom("Poulet DG");
        pouletDG.setDescription("Poulet sauté avec plantains et légumes frais");
        pouletDG.setPrix(4500.0);
        pouletDG.setIngredients(List.of("Poulet", "Plantains", "Carottes", "Poivrons"));
        pouletDG.setDisponible(true);
        pouletDG.setPopulaire(true);
        pouletDG.setTempsPreparation(20);
        pouletDG.setNoteGlobale(4.9);
        platRepository.save(pouletDG);

        Plat ndole = new Plat();
        ndole.setRestaurant(r);
        ndole.setCategorie(specialites);
        ndole.setNom("Ndolé");
        ndole.setDescription("Feuilles amères aux crevettes et arachides");
        ndole.setPrix(3500.0);
        ndole.setIngredients(List.of("Feuilles ndolé", "Crevettes", "Arachides", "Poisson fumé"));
        ndole.setDisponible(true);
        ndole.setPopulaire(true);
        ndole.setTempsPreparation(30);
        ndole.setNoteGlobale(4.7);
        platRepository.save(ndole);

        // Catégorie Boissons
        Categorie boissons = new Categorie();
        boissons.setRestaurant(r);
        boissons.setNom("Boissons");
        boissons.setIcone("🍹");
        boissons.setOrdre(3);
        boissons = categorieRepository.save(boissons);
        r.getMenu().add(boissons);
        restaurantRepository.save(r);

        Plat jusBissap = new Plat();
        jusBissap.setRestaurant(r);
        jusBissap.setCategorie(boissons);
        jusBissap.setNom("Jus de Bissap");
        jusBissap.setDescription("Hibiscus frais, gingembre et menthe");
        jusBissap.setPrix(800.0);
        jusBissap.setIngredients(List.of("Hibiscus", "Gingembre", "Menthe", "Sucre"));
        jusBissap.setDisponible(true);
        jusBissap.setVegetarien(true);
        jusBissap.setTempsPreparation(5);
        platRepository.save(jusBissap);
    }

    private void ajouterMenuPizza(Restaurant r) {
        Categorie pizzas = new Categorie();
        pizzas.setRestaurant(r);
        pizzas.setNom("Pizzas");
        pizzas.setIcone("🍕");
        pizzas.setOrdre(1);
        pizzas = categorieRepository.save(pizzas);
        r.getMenu().add(pizzas);
        restaurantRepository.save(r);

        Plat margarita = new Plat();
        margarita.setRestaurant(r);
        margarita.setCategorie(pizzas);
        margarita.setNom("Margherita");
        margarita.setDescription("Sauce tomate, mozzarella, basilic frais");
        margarita.setPrix(6500.0);
        margarita.setIngredients(List.of("Sauce tomate", "Mozzarella", "Basilic"));
        margarita.setDisponible(true);
        margarita.setVegetarien(true);
        margarita.setTempsPreparation(20);
        platRepository.save(margarita);
    }
}
