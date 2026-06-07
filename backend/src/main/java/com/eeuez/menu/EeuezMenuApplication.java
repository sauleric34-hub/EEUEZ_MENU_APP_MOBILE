package com.eeuez.menu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class EeuezMenuApplication {
    public static void main(String[] args) {
        SpringApplication.run(EeuezMenuApplication.class, args);
        System.out.println("\n╔══════════════════════════════════════════════╗");
        System.out.println("║   🍽️  EEUEZ MENU BACKEND — Démarré !         ║");
        System.out.println("║   API:        http://localhost:8080/api       ║");
        System.out.println("║   H2 Console: http://localhost:8080/h2-console║");
        System.out.println("╚══════════════════════════════════════════════╝\n");
    }
}
