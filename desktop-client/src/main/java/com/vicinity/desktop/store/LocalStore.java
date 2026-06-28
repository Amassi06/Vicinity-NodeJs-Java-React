package com.vicinity.desktop.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vicinity.desktop.api.dto.MeResponse;
import com.vicinity.desktop.api.dto.Neighbourhood;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import com.vicinity.desktop.api.dto.Incident;
import java.util.UUID;

public final class LocalStore {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static volatile String jdbcUrl;

    private LocalStore() {}

    public static synchronized void init() throws SQLException {
        if (jdbcUrl != null) {
            return;
        }
        final Path dir = Path.of(System.getProperty("user.home"), ".vicinity", "data");
        try {
            Files.createDirectories(dir);
        } catch (java.io.IOException e) {
            throw new SQLException("Impossible de créer " + dir, e);
        }
        jdbcUrl = "jdbc:h2:" + dir.resolve("vicinity-desktop").toAbsolutePath();
        try (Connection conn = connection(); Statement st = conn.createStatement()) {
            st.execute(
                    """
                    CREATE TABLE IF NOT EXISTS app_session (
                      id INT PRIMARY KEY,
                      access_token CLOB NOT NULL,
                      refresh_token CLOB,
                      user_json CLOB NOT NULL,
                      updated_at TIMESTAMP NOT NULL
                    )
                    """);
            st.execute(
                    """
                    CREATE TABLE IF NOT EXISTS neighbourhoods_cache (
                      id VARCHAR(36) PRIMARY KEY,
                      name VARCHAR(200) NOT NULL,
                      description CLOB,
                      payload_json CLOB NOT NULL,
                      synced_at TIMESTAMP NOT NULL
                    )
                    """);

            st.execute(
                    """
                    CREATE TABLE IF NOT EXISTS incidents_cache (
                      id VARCHAR(36) PRIMARY KEY,
                      title VARCHAR(200) NOT NULL,
                      description CLOB,
                      severity VARCHAR(30) NOT NULL,
                      status VARCHAR(30) NOT NULL,
                      sync_status VARCHAR(30) NOT NULL,
                      created_at TIMESTAMP NOT NULL,
                      updated_at TIMESTAMP NOT NULL
                    )
                    """);
        }
    }

    public static void saveSession(
            final String accessToken, final String refreshToken, final MeResponse user) {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                MERGE INTO app_session (id, access_token, refresh_token, user_json, updated_at)
                                KEY (id)
                                VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
                                """)) {
            ps.setString(1, accessToken);
            ps.setString(2, refreshToken);
            ps.setString(3, MAPPER.writeValueAsString(user));
            ps.executeUpdate();
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de sauvegarder la session", e);
        }
    }

    public static PersistedSession loadSession() {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                "SELECT access_token, refresh_token, user_json FROM app_session WHERE id = 1");
                ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                return null;
            }
            final MeResponse user = MAPPER.readValue(rs.getString("user_json"), MeResponse.class);
            return new PersistedSession(
                    rs.getString("access_token"),
                    rs.getString("refresh_token"),
                    user);
        } catch (Exception e) {
            return null;
        }
    }

    public static void clearSession() {
        try (Connection conn = connection();
                Statement st = conn.createStatement()) {
            st.executeUpdate("DELETE FROM app_session");
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible d'effacer la session", e);
        }
    }

    public static void replaceNeighbourhoods(final List<Neighbourhood> items) {
        try (Connection conn = connection()) {
            conn.setAutoCommit(false);
            try (Statement clear = conn.createStatement()) {
                clear.executeUpdate("DELETE FROM neighbourhoods_cache");
            }
            try (PreparedStatement ps =
                    conn.prepareStatement(
                            """
                            INSERT INTO neighbourhoods_cache
                              (id, name, description, payload_json, synced_at)
                            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                            """)) {
                for (final Neighbourhood n : items) {
                    ps.setString(1, n.id());
                    ps.setString(2, n.name());
                    ps.setString(3, n.description());
                    ps.setString(4, MAPPER.writeValueAsString(n));
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            conn.commit();
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de mettre en cache les quartiers", e);
        }
    }

    public static List<Neighbourhood> loadNeighbourhoods() {
        final List<Neighbourhood> out = new ArrayList<>();
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                SELECT payload_json FROM neighbourhoods_cache
                                ORDER BY name
                                """);
                ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                out.add(MAPPER.readValue(rs.getString("payload_json"), Neighbourhood.class));
            }
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de lire le cache quartiers", e);
        }
        return out;
    }

    public static Optional<Instant> lastNeighbourhoodSync() {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                "SELECT MAX(synced_at) AS t FROM neighbourhoods_cache");
                ResultSet rs = ps.executeQuery()) {
            if (rs.next() && rs.getTimestamp("t") != null) {
                return Optional.of(rs.getTimestamp("t").toInstant());
            }
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
        return Optional.empty();
    }

    public static Incident createIncident(
        final String title, final String description, final String severity) {
        final Instant now = Instant.now();
        final Incident incident =
                new Incident(
                        UUID.randomUUID().toString(),
                        title,
                        description,
                        severity,
                        "OPEN",
                        "LOCAL",
                        now,
                        now);

        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                INSERT INTO incidents_cache
                                  (id, title, description, severity, status, sync_status, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                """)) {
            ps.setString(1, incident.id());
            ps.setString(2, incident.title());
            ps.setString(3, incident.description());
            ps.setString(4, incident.severity());
            ps.setString(5, incident.status());
            ps.setString(6, incident.syncStatus());
            ps.setTimestamp(7, java.sql.Timestamp.from(incident.createdAt()));
            ps.setTimestamp(8, java.sql.Timestamp.from(incident.updatedAt()));
            ps.executeUpdate();
            return incident;
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible de créer l'incident local", e);
        }
    }

    public static List<Incident> loadIncidents() {
        final List<Incident> out = new ArrayList<>();
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                SELECT id, title, description, severity, status, sync_status, created_at, updated_at
                                FROM incidents_cache
                                ORDER BY created_at DESC
                                """);
                ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                out.add(
                        new Incident(
                                rs.getString("id"),
                                rs.getString("title"),
                                rs.getString("description"),
                                rs.getString("severity"),
                                rs.getString("status"),
                                rs.getString("sync_status"),
                                rs.getTimestamp("created_at").toInstant(),
                                rs.getTimestamp("updated_at").toInstant()));
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible de lire les incidents locaux", e);
        }
        return out;
    }

    public static void resolveIncident(final String id) {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                UPDATE incidents_cache
                                SET status = 'RESOLVED',
                                    sync_status = CASE
                                      WHEN sync_status = 'SYNCED' THEN 'LOCAL'
                                      ELSE sync_status
                                    END,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                                """)) {
            ps.setString(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible de résoudre l'incident local", e);
        }
    }

    public static IncidentStats incidentStats() {
        try (Connection conn = connection();
                PreparedStatement ps =
                        conn.prepareStatement(
                                """
                                SELECT
                                  COUNT(*) AS total,
                                  SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_count,
                                  SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_count,
                                  SUM(CASE WHEN sync_status <> 'SYNCED' THEN 1 ELSE 0 END) AS pending_sync
                                FROM incidents_cache
                                """);
                ResultSet rs = ps.executeQuery()) {
            if (rs.next()) {
                return new IncidentStats(
                        rs.getInt("total"),
                        rs.getInt("open_count"),
                        rs.getInt("resolved_count"),
                        rs.getInt("pending_sync"));
            }
            return new IncidentStats(0, 0, 0, 0);
        } catch (SQLException e) {
            throw new IllegalStateException("Impossible de calculer les statistiques incidents", e);
        }
    }

    public record IncidentStats(int total, int open, int resolved, int pendingSync) {}

public static List<Incident> loadPendingIncidents() {
    final List<Incident> out = new ArrayList<>();
    try (Connection conn = connection();
            PreparedStatement ps =
                    conn.prepareStatement(
                            """
                            SELECT id, title, description, severity, status, sync_status, created_at, updated_at
                            FROM incidents_cache
                            WHERE sync_status <> 'SYNCED'
                            ORDER BY created_at ASC
                            """);
            ResultSet rs = ps.executeQuery()) {
        while (rs.next()) {
            out.add(
                    new Incident(
                            rs.getString("id"),
                            rs.getString("title"),
                            rs.getString("description"),
                            rs.getString("severity"),
                            rs.getString("status"),
                            rs.getString("sync_status"),
                            rs.getTimestamp("created_at").toInstant(),
                            rs.getTimestamp("updated_at").toInstant()));
        }
    } catch (SQLException e) {
        throw new IllegalStateException("Impossible de lire les incidents à synchroniser", e);
    }
    return out;
}

public static void markIncidentSynced(final String id) {
    try (Connection conn = connection();
            PreparedStatement ps =
                    conn.prepareStatement(
                            """
                            UPDATE incidents_cache
                            SET sync_status = 'SYNCED',
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                            """)) {
        ps.setString(1, id);
        ps.executeUpdate();
    } catch (SQLException e) {
        throw new IllegalStateException("Impossible de marquer l'incident comme synchronisé", e);
    }
}

public static void markIncidentSyncFailed(final String id) {
    try (Connection conn = connection();
            PreparedStatement ps =
                    conn.prepareStatement(
                            """
                            UPDATE incidents_cache
                            SET sync_status = 'FAILED',
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                            """)) {
        ps.setString(1, id);
        ps.executeUpdate();
    } catch (SQLException e) {
        throw new IllegalStateException("Impossible de marquer l'incident comme échoué", e);
    }
}

    private static Connection connection() throws SQLException {
        if (jdbcUrl == null) {
            throw new IllegalStateException("LocalStore.init() non appelé");
        }
        return DriverManager.getConnection(jdbcUrl, "sa", "");
    }

    public record PersistedSession(String accessToken, String refreshToken, MeResponse user) {}
}
