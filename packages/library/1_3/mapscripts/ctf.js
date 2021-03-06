// (C) 2009 Alon 'Kripken' Zakai

Library.include('library/1_3/');

Library.include('library/' + Global.LIBRARY_VERSION + '/__CorePatches');
Library.include('library/' + Global.LIBRARY_VERSION + '/Plugins');
Library.include('library/' + Global.LIBRARY_VERSION + '/Firing');
Library.include('library/' + Global.LIBRARY_VERSION + '/Chat');
Library.include('library/' + Global.LIBRARY_VERSION + '/Health');
Library.include('library/' + Global.LIBRARY_VERSION + '/World');
Library.include('library/' + Global.LIBRARY_VERSION + '/GameManager');
Library.include('library/' + Global.LIBRARY_VERSION + '/modes/CTF');
Library.include('library/' + Global.LIBRARY_VERSION + '/AutoTargeting');
Library.include('library/' + Global.LIBRARY_VERSION + '/MultipartRendering');
Library.include('library/' + Global.LIBRARY_VERSION + '/guns/Insta');
Library.include('library/' + Global.LIBRARY_VERSION + '/guns/Stunball');
Library.include('library/' + Global.LIBRARY_VERSION + '/guns/Rocket');
Library.include('library/' + Global.LIBRARY_VERSION + '/guns/Shotgun');
Library.include('library/' + Global.LIBRARY_VERSION + '/guns/Chaingun');
Library.include('library/' + Global.LIBRARY_VERSION + '/mapelements/JumpPads');
Library.include('library/' + Global.LIBRARY_VERSION + '/mapelements/Cannons');

// Default materials, etc.

Library.include('library/' + Global.LIBRARY_VERSION + '/MapDefaults');

// Textures

Library.include('textures/gk/brick3/');
Library.include('textures/gk/concrete3/');
Library.include('textures/gk/deco3/');
Library.include('textures/gk/ground3/');
Library.include('textures/gk/metal3/');
Library.include('textures/gk/morter3/');
Library.include('textures/gk/rock3/');
Library.include('textures/gk/walls3/');
Library.include('textures/gk/wood3/');

Library.include('yo_frankie/'); // TODO: Remove

// Map settings

Map.fogColor(0, 0, 0);
Map.fog(2500);
//Map.loadSky("skyboxes/blue_orange/1");
Map.loadSky("skyboxes/philo/sky3");
Map.skylight(50, 50, 50);
Map.ambient(10);
Map.shadowmapAmbient("0x101010");
Map.shadowmapAngle(300);

//// Player class

PowerfulRocket = Rocket.extend({
    explosionPower: 200.0,
});

PowerfulRocketGun = RocketGun.extend({
    projectileClass: PowerfulRocket,
});

playerChaingun = Firing.registerGun(new Chaingun(), 'Chaingun', 'packages/hud/gui_gk_Icon_w01.png');
playerSniperGun = Firing.registerGun(new InstaGun(), 'Sniper Rifle', 'packages/hud/gui_gk_Icon_w03.png');
playerShotgun = Firing.registerGun(new Shotgun(), 'Shotgun', 'packages/hud/gui_gk_Icon_w04.png');
playerRocketLauncher = Firing.registerGun(new PowerfulRocketGun(), 'Rocket Launcher', 'packages/hud/gui_gk_Icon_w02.png');
playerSeekingRocketLauncher = Firing.registerGun(new SeekingRocketGun(), 'Seeking Rocket Launcher', 'packages/hud/gui_gk_Icon_w02b.png');

registerEntityClass(
    bakePlugins(
        Player,
        [
            Chat.playerPlugin,
            Firing.plugins.protocol,
            Firing.plugins.player,
            Health.plugin,
            GameManager.playerPlugin,
            CTFMode.playerPlugin,
            Projectiles.plugin,
            StunballVictimPlugin,
            TargetLockingPlugin,
            HeadshotPlugin,
            Chaingun.plugin,
            Character.plugins.effectiveCameraHeight,
            {
                _class: "GamePlayer",

                init: function() {
                    this.modelName = ''; // Start invisible, until spawned
                    this.canMove = false; // Start immobile, until spawned
                    this.gunIndexes = [playerSniperGun, playerShotgun, playerRocketLauncher, playerSeekingRocketLauncher];
                    this.maxHealth = 250;
                },

                activate: function() {
                    this.movementSpeed = 95; // Almost the same as sauer (100)
                    this.gunIndexes = [playerChaingun, playerSniperGun, playerShotgun, playerRocketLauncher, playerSeekingRocketLauncher];
                    this.currGunIndex = playerChaingun;
                },

                clientActivate: function() {
                    // XXX - remove when hudmodelname is a state var
                    this.connect('client_onModify_team', function(team) {
                        this.HUDModelName = 'stromar_1_1/hud/' + team;
                    });
                },
            }
        ]
    )
);

// Autocannons

makeCannon('InstaCannon', RocketGun.extend({
    projectileClass: Rocket.extend({
        explosionPower: 50,
        speed: 250,
        timeLeft: 8.0,
        gravityFactor: 0,
    }),
}), [Projectiles.plugin, {
    healthSystem: 'regen',
    maxHealth: 30,
}]);

makeCannon('StunCannon', RocketGun.extend({
    projectileClass: Rocket.extend({
        explosionPower: 15,
        speed: 150,
        timeLeft: 8.0,
        gravityFactor: 0,
    }),
}), [Projectiles.plugin, {
    healthSystem: 'regen',
    maxHealth: 30,
}]);

//// Application

ApplicationManager.setApplicationClass(Application.extend({
    _class: "GameApplication",

    getPcClass: function() {
        return "GamePlayer";
    },

    // Replace this with appropriate behaviour for when a player falls of the map
    clientOnEntityOffMap: Health.dieIfOffMap,

    getScoreboardText: GameManager.getScoreboardText,

    clientClick: Firing.clientClick,

    actionKey: function(index, down) {
        if (!down) return;
        if (index === 0) { // action key 0: Help
            UserInterface.showMessage("1-5: Select weapon. Middle mouse: Cycle weapons");
        } else if (index >= 1 && index <= 5) { // Or: bind MOUSE2 actionkey1
            var gunIndexes = getPlayerEntity().gunIndexes.asArray();
            if (findIdentical(gunIndexes, index-1) >= 0) {
                getPlayerEntity().currGunIndex = index-1;
            }
        } else if (index === 7) { // die
            getPlayerEntity().health = 0;
        }
//            GameManager.getSingleton().dropFlags(getPlayerEntity()); // TODO - buggy
    },
}));

//// Load permanent entities

Projectiles.serverside = false;

GameManager.setup([
    CTFMode.managerPlugin,
    merge(GameManager.managerPlugins.limitGameTime, { MAX_TIME: 10*60 }),
    merge(GameManager.managerPlugins.limitGameScore, { MAX_SCORE: 10 }),
    GameManager.managerPlugins.intermission,
    GameManager.managerPlugins.messages,
    GameManager.managerPlugins.balancer,
    AutoTargeting.managerPlugin,
    GameManager.managerPlugins.eventList,
    ParallelActionsPlugin,
    Projectiles.plugin,
    {
        clientActivate: function() {
            if (!this.shownWelcome) {
                this.addHUDMessage("Press 'H' for help", 0xCCDDFF, 8.0);
                this.shownWelcome = true;
            }
        },
    },
]);

if (Global.SERVER) { // Run this only on the server - not the clients
    var entities = CAPI.readFile("./entities.json");
    loadEntities(entities);

    GameManager.getSingleton().registerTeams([
        {
            _name: 'red',
            setup: function(player) {
                player.defaultModelName = 'stromar_1_1/red';
//XXX                player.HUDModelName = 'stromar_1_1/hud/red'; // apply when this is a state var, and remove the above XXX
            },
            flagModelName: 'flag/red',
        },
        {
            _name: 'blue',
            setup: function(player) {
                player.defaultModelName = 'stromar_1_1/blue';
//XXX                player.HUDModelName = 'stromar_1_1/hud/blue';
            },
            flagModelName: 'flag/blue',
        },
    ]);
}

Map.preloadModel('stromar/red');
Map.preloadModel('stromar/blue');
//Map.preloadModel('stromar/hud/red');  // Don't load, because (1) not everyone uses first person, 
//Map.preloadModel('stromar/hud/blue'); // (2) you may need only one of these, not both
Map.preloadModel('flag/red');
Map.preloadModel('flag/blue');

if (Global.CLIENT) {
    if (CAPI.setDefaultThirdpersonMode) {
        CAPI.setDefaultThirdpersonMode(0);
    }
}

