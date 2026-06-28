package com.vicinity.desktop.api.dto;

import java.time.Instant;

public record Incident(
        String id,
        String title,
        String description,
        String severity,
        String status,
        String syncStatus,
        Instant createdAt,
        Instant updatedAt
) {}