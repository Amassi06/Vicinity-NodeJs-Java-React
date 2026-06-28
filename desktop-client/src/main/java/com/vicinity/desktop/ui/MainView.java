package com.vicinity.desktop.ui;

import com.vicinity.desktop.api.VicinityApiClient;
import com.vicinity.desktop.api.dto.MeResponse;
import com.vicinity.desktop.session.AppSession;
import com.vicinity.desktop.ui.tabs.DslTab;
import com.vicinity.desktop.ui.tabs.PluginsTab;
import com.vicinity.desktop.ui.tabs.HomeTab;
import com.vicinity.desktop.ui.tabs.NeighbourhoodsTab;
import com.vicinity.desktop.ui.tabs.WalletTab;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.concurrent.Task;
import com.vicinity.desktop.ui.tabs.IncidentsTab;

public final class MainView extends BorderPane {

    private final VicinityApiClient api;
    private final Runnable onLogout;
    private final HomeTab homeTab;
    private final NeighbourhoodsTab neighbourhoodsTab;
    private final Label offlineBadge = new Label();

    public MainView(final VicinityApiClient api, final Runnable onLogout) {
        this.api = api;
        this.onLogout = onLogout;
        this.homeTab = new HomeTab(api);
        this.neighbourhoodsTab = new NeighbourhoodsTab(api);
        buildToolbar();
        buildTabs();
    }

    public void onShown() {
        homeTab.refreshStatic();
        refreshSessionOnline();
    }

    private void buildToolbar() {
        final MeResponse user = AppSession.user();
        final Label who =
                new Label(
                        user == null
                                ? "—"
                                : user.email() + "  ·  " + user.role());
        who.getStyleClass().add("label-muted");

        offlineBadge.getStyleClass().add("label-error");
        offlineBadge.setVisible(AppSession.isOffline());

        final Button syncBtn = new Button("Sync quartiers");
        syncBtn.getStyleClass().add("button-secondary");
        syncBtn.setOnAction(e -> neighbourhoodsTab.syncFromApi(syncBtn));

        final Button logoutBtn = new Button("Déconnexion");
        logoutBtn.getStyleClass().add("button-secondary");
        logoutBtn.setOnAction(
                e -> {
                    api.logoutRemote();
                    AppSession.clear();
                    onLogout.run();
                });

        final HBox bar = new HBox(12, who, offlineBadge, syncBtn, logoutBtn);
        bar.setAlignment(Pos.CENTER_LEFT);
        bar.getStyleClass().add("toolbar");
        bar.setPadding(new Insets(10, 16, 10, 16));
        HBox.setHgrow(who, javafx.scene.layout.Priority.ALWAYS);
        setTop(bar);
    }

    private void buildTabs() {
        final TabPane tabs = new TabPane();
        tabs.setTabClosingPolicy(TabPane.TabClosingPolicy.UNAVAILABLE);

        final Tab home = new Tab("Accueil", homeTab);
        final Tab hoods = new Tab("Quartiers", neighbourhoodsTab);
        final Tab incidents = new Tab("Incidents", new IncidentsTab());
        final Tab wallet = new Tab("Portefeuille", new WalletTab(api));
        final Tab dsl = new Tab("DSL", new DslTab(api));
        final Tab plugins = new Tab("Plugins", new PluginsTab(api));

        tabs.getTabs().addAll(home, hoods, incidents, wallet, dsl, plugins);
        setCenter(tabs);
    }

    private void refreshSessionOnline() {
        if (AppSession.isOffline()) {
            offlineBadge.setVisible(true);
            offlineBadge.setText("Hors ligne");
            return;
        }

        final Task<MeResponse> task =
                new Task<>() {
                    @Override
                    protected MeResponse call() throws Exception {
                        return api.me();
                    }
                };

        task.setOnSucceeded(
                ev -> {
                    offlineBadge.setVisible(false);
                    AppSession.updateUser(task.getValue());
                    homeTab.refreshStatic();
                });

        task.setOnFailed(
                ev -> {
                    AppSession.markOffline();
                    offlineBadge.setVisible(true);
                    offlineBadge.setText("Hors ligne — cache local");
                    homeTab.refreshStatic();
                });

        Thread.ofVirtual().start(task);
    }
}
