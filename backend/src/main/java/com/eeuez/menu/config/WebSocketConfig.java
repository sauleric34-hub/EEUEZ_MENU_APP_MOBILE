package com.eeuez.menu.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Configuration WebSocket STOMP pour le suivi de livraison en temps réel.
 *
 * Usage depuis React Native (avec @stomp/stompjs) :
 *   const client = new Client({ brokerURL: 'ws://192.168.x.x:8080/ws' });
 *   client.subscribe('/topic/commande/42/tracking', (msg) => { ... });
 *
 * Le livreur envoie sa position via :
 *   client.publish({ destination: '/app/tracking/update', body: JSON.stringify({...}) });
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS(); // Fallback pour les environnements sans WebSocket natif
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Les clients s'abonnent à /topic/...
        config.enableSimpleBroker("/topic", "/queue");

        // Les messages envoyés au serveur commencent par /app/...
        config.setApplicationDestinationPrefixes("/app");

        // Messages privés (notifications push)
        config.setUserDestinationPrefix("/user");
    }
}
