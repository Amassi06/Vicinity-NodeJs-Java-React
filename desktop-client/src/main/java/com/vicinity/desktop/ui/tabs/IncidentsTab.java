package com.vicinity.desktop.ui.tabs;

import com.vicinity.desktop.api.dto.Incident;
import com.vicinity.desktop.store.LocalStore;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import com.vicinity.desktop.api.VicinityApiClient;

public final class IncidentsTab extends VBox {

    private final VicinityApiClient api;
    private final ObservableList<Incident> incidents = FXCollections.observableArrayList();
    private final ListView<Incident> listView = new ListView<>(incidents);
    private final Label statsLabel = new Label();

    public IncidentsTab(final VicinityApiClient api) {
        this.api = api;
        getStyleClass().add("panel");
        setSpacing(12);
        setPadding(new Insets(16));
        build();
        refresh();
    }

    private void build() {
        final Label title = new Label("Incidents et alertes");
        title.getStyleClass().add("label-title");

        final TextField titleField = new TextField();
        titleField.setPromptText("Titre de l'incident");

        final TextArea descriptionArea = new TextArea();
        descriptionArea.setPromptText("Description");
        descriptionArea.setPrefRowCount(3);
        descriptionArea.setWrapText(true);

        final ComboBox<String> severityBox =
                new ComboBox<>(FXCollections.observableArrayList("LOW", "MEDIUM", "HIGH", "CRITICAL"));
        severityBox.setValue("MEDIUM");

        final Button createBtn = new Button("Créer localement");
        createBtn.setOnAction(
                e -> {
                    final String incidentTitle = titleField.getText() == null ? "" : titleField.getText().trim();
                    if (incidentTitle.isBlank()) {
                        statsLabel.setText("Le titre est obligatoire.");
                        return;
                    }

                    LocalStore.createIncident(
                            incidentTitle,
                            descriptionArea.getText(),
                            severityBox.getValue());

                    titleField.clear();
                    descriptionArea.clear();
                    severityBox.setValue("MEDIUM");
                    refresh();
                });

        final Button resolveBtn = new Button("Marquer comme résolu");
        resolveBtn.getStyleClass().add("button-secondary");
        resolveBtn.setOnAction(
                e -> {
                    final Incident selected = listView.getSelectionModel().getSelectedItem();
                    if (selected == null) {
                        statsLabel.setText("Sélectionne d'abord un incident.");
                        return;
                    }
                    LocalStore.resolveIncident(selected.id());
                    refresh();
                });

        final Button refreshBtn = new Button("Rafraîchir");
        refreshBtn.getStyleClass().add("button-secondary");
        refreshBtn.setOnAction(e -> refresh());

        listView.setCellFactory(
                ignored ->
                        new javafx.scene.control.ListCell<>() {
                            @Override
                            protected void updateItem(final Incident item, final boolean empty) {
                                super.updateItem(item, empty);
                                if (empty || item == null) {
                                    setText(null);
                                } else {
                                    setText(
                                            item.title()
                                                    + "\nGravité : "
                                                    + item.severity()
                                                    + " · Statut : "
                                                    + item.status()
                                                    + " · Sync : "
                                                    + item.syncStatus()
                                                    + "\n"
                                                    + (item.description() == null ? "" : item.description()));
                                }
                            }
                        });
        
        final Button syncBtn = new Button("Synchroniser");
syncBtn.setOnAction(
        e -> {
            try {
                int synced = 0;
                int failed = 0;

                for (Incident incident : LocalStore.loadPendingIncidents()) {
                    try {
                        api.createIncident(incident);
                        LocalStore.markIncidentSynced(incident.id());
                        synced++;
                    } catch (Exception syncError) {
                        LocalStore.markIncidentSyncFailed(incident.id());
                        failed++;
                    }
                }

                refresh();
                statsLabel.setText(
                        "Synchronisation terminée · OK : "
                                + synced
                                + " · Échecs : "
                                + failed);
            } catch (Exception ex) {
                statsLabel.setText("Erreur de synchronisation : " + ex.getMessage());
            }
        });

final HBox actions = new HBox(8, severityBox, createBtn, resolveBtn, refreshBtn, syncBtn);

        getChildren()
                .addAll(
                        title,
                        new Label("Créer un incident utilisable même hors ligne :"),
                        titleField,
                        descriptionArea,
                        actions,
                        statsLabel,
                        listView);
    }

    private void refresh() {
        incidents.setAll(LocalStore.loadIncidents());
        final LocalStore.IncidentStats stats = LocalStore.incidentStats();
        statsLabel.setText(
                "Total : "
                        + stats.total()
                        + " · Ouverts : "
                        + stats.open()
                        + " · Résolus : "
                        + stats.resolved()
                        + " · À synchroniser : "
                        + stats.pendingSync());
    }
}