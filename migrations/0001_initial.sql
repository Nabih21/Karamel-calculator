CREATE TABLE ingredients (id TEXT PRIMARY KEY, name TEXT NOT NULL, weight REAL CHECK(weight>0), price REAL CHECK(price>=0));
CREATE TABLE packaging (id TEXT PRIMARY KEY, name TEXT NOT NULL, weight REAL CHECK(weight>0), price REAL CHECK(price>=0));
CREATE TABLE recipes (id TEXT PRIMARY KEY, name TEXT NOT NULL, pieces REAL CHECK(pieces>0), ratio REAL CHECK(ratio>0 AND ratio<=1), status TEXT NOT NULL DEFAULT 'Draft');
CREATE TABLE recipeIngredients (id TEXT PRIMARY KEY, name TEXT NOT NULL, recipe TEXT REFERENCES recipes(id), item TEXT REFERENCES ingredients(id), qty REAL CHECK(qty>0));
CREATE TABLE recipePackaging (id TEXT PRIMARY KEY, name TEXT NOT NULL, recipe TEXT REFERENCES recipes(id), item TEXT REFERENCES packaging(id), qty REAL CHECK(qty>0));
CREATE TABLE overhead (id TEXT PRIMARY KEY, name TEXT NOT NULL, recipe TEXT REFERENCES recipes(id), amount REAL CHECK(amount>=0));
CREATE INDEX ingredient_recipe ON recipeIngredients(recipe);
CREATE INDEX packaging_recipe ON recipePackaging(recipe);
CREATE INDEX overhead_recipe ON overhead(recipe);
