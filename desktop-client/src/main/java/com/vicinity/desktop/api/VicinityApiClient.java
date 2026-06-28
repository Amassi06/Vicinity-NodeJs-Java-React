package com.vicinity.desktop.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.vicinity.desktop.api.dto.AuthResult;
import com.vicinity.desktop.api.dto.MeResponse;
import com.vicinity.desktop.api.dto.Neighbourhood;
import com.vicinity.desktop.config.DesktopConfig;
import com.vicinity.desktop.session.AppSession;
import java.io.IOException;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import com.vicinity.desktop.api.dto.Incident;
import java.io.IOException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import com.vicinity.desktop.api.dto.Incident;

public final class VicinityApiClient {

    private static final TypeReference<List<Neighbourhood>> NEIGHBOURHOOD_LIST =
            new TypeReference<>() {};

    private final DesktopConfig config;
    private final HttpClient http;
    private final ObjectMapper mapper;

    public VicinityApiClient(final DesktopConfig config) {
        this.config = config;
        this.http =
                HttpClient.newBuilder()
                        .version(HttpClient.Version.HTTP_1_1)
                        .connectTimeout(Duration.ofSeconds(8))
                        .build();
        this.mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    public DesktopConfig config() {
        return config;
    }

    public AuthResult login(final String email, final String password) throws Exception {
        return exchange(
                "POST",
                "/auth/login",
                Optional.of(Map.of("email", email, "password", password)),
                false,
                AuthResult.class);
    }

    public MeResponse me() throws Exception {
        return exchange("GET", "/auth/me", Optional.empty(), true, MeResponse.class);
    }

    public List<Neighbourhood> listNeighbourhoods() throws Exception {
        return exchange(
                "GET",
                "/neighbourhoods",
                Optional.empty(),
                true,
                NEIGHBOURHOOD_LIST);
    }

    public JsonNode compileDsl(final String dsl) throws Exception {
        final JsonNode root =
                exchange(
                        "POST",
                        "/dsl/compile",
                        Optional.of(Map.of("dsl", dsl)),
                        true,
                        JsonNode.class);
        return root.get("compiled");
    }

    public void adminCreditWallet(final String toUserId, final int amount, final String reason)
            throws Exception {
        exchange(
                "POST",
                "/admin/wallet/credit",
                Optional.of(Map.of("toUserId", toUserId, "amount", amount, "reason", reason)),
                true,
                Void.class);
    }

    public JsonNode healthz() throws Exception {
        return exchange("GET", "/healthz", Optional.empty(), false, JsonNode.class);
    }

    public JsonNode readyz() throws Exception {
        return exchange("GET", "/readyz", Optional.empty(), false, JsonNode.class);
    }

    public JsonNode getPluginsCatalog() throws Exception {
        return exchange("GET", "/plugins", Optional.empty(), true, JsonNode.class);
    }

    public void logoutRemote() {
        final String refresh = AppSession.refreshToken();
        if (refresh == null || refresh.isBlank()) {
            return;
        }
        try {
            exchange(
                    "POST",
                    "/auth/logout",
                    Optional.of(Map.of("refreshToken", refresh)),
                    false,
                    Void.class);
        } catch (Exception ignored) {
            // déconnexion locale même si le réseau échoue
        }
    }

public void createIncident(final Incident incident) throws Exception {
    exchange(
            "POST",
            "/admin/incidents",
            Optional.of(
                    Map.of(
                            "localId", incident.id(),
                            "title", incident.title(),
                            "description", incident.description() == null ? "" : incident.description(),
                            "severity", incident.severity())),
            true,
            Void.class);
}

    private <T> T exchange(
            final String method,
            final String path,
            final Optional<Object> body,
            final boolean auth,
            final Class<T> type)
            throws Exception {
        HttpResponse<String> response = sendOnce(method, path, body, auth);
        if (auth && response.statusCode() == 401 && AppSession.refreshToken() != null) {
            refreshTokens();
            response = sendOnce(method, path, body, auth);
        }
        if (response.statusCode() >= 400) {
            throw parseError(response);
        }
        if (type == Void.class || response.statusCode() == 204 || response.body().isBlank()) {
            return null;
        }
        return mapper.readValue(response.body(), type);
    }

    private <T> T exchange(
            final String method,
            final String path,
            final Optional<Object> body,
            final boolean auth,
            final TypeReference<T> typeRef)
            throws Exception {
        HttpResponse<String> response = sendOnce(method, path, body, auth);
        if (auth && response.statusCode() == 401 && AppSession.refreshToken() != null) {
            refreshTokens();
            response = sendOnce(method, path, body, auth);
        }
        if (response.statusCode() >= 400) {
            throw parseError(response);
        }
        if (response.body().isBlank()) {
            return null;
        }
        return mapper.readValue(response.body(), typeRef);
    }

    private HttpResponse<String> sendOnce(
            final String method,
            final String path,
            final Optional<Object> body,
            final boolean auth)
            throws Exception {
        final URI uri = config.resolve(path);
        final HttpRequest.Builder builder =
                HttpRequest.newBuilder().uri(uri).timeout(Duration.ofSeconds(30));
        builder.header("Accept", "application/json");

        if (body.isPresent()) {
            builder.header("Content-Type", "application/json");
            builder.method(
                    method,
                    HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body.get())));
        } else if ("POST".equals(method)) {
            builder.POST(HttpRequest.BodyPublishers.noBody());
        } else {
            builder.GET();
        }

        if (auth) {
            final String token = AppSession.accessToken();
            if (token == null || token.isBlank()) {
                throw new ApiException(401, "missing_token");
            }
            builder.header("Authorization", "Bearer " + token);
        }

        try {
            return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw toFriendlyNetworkError(uri, e);
        }
    }

    private ApiException toFriendlyNetworkError(final URI uri, final IOException e) {
        final String detail = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        final boolean parser =
                detail.contains("header parser") || detail.contains("received no bytes");
        final boolean refused = e instanceof ConnectException;

        final StringBuilder msg = new StringBuilder();
        if (config.looksLikeWebDevServer()) {
            msg.append(
                    "URL incorrecte : vous pointez vers le front Vite (5173/5174). "
                            + "Utilisez http://localhost:3000 (backend). ");
        } else if (refused || parser) {
            msg.append(
                    "Backend injoignable à ")
                    .append(config.apiBaseUrl())
                    .append(" — lancez : cd backend && npm run dev (et make up pour les bases). ");
        }
        msg.append('[').append(uri).append("] ").append(detail);
        return new ApiException(0, msg.toString());
    }

    private void refreshTokens() throws Exception {
        final String refresh = AppSession.refreshToken();
        if (refresh == null || refresh.isBlank()) {
            throw new ApiException(401, "invalid_session");
        }
        final JsonNode node =
                exchange(
                        "POST",
                        "/auth/refresh",
                        Optional.of(Map.of("refreshToken", refresh)),
                        false,
                        JsonNode.class);
        AppSession.applyTokens(
                node.get("accessToken").asText(), node.get("refreshToken").asText());
    }

    private ApiException parseError(final HttpResponse<String> response) {
        String message = response.statusCode() + " " + response.uri();
        try {
            final JsonNode node = mapper.readTree(response.body());
            if (node.has("error")) {
                message = node.get("error").asText();
            }
        } catch (Exception ignored) {
            // garde le message HTTP
        }
        return new ApiException(response.statusCode(), message);
    }
}
