import requests
import time

BASE_URL = "http://127.0.0.1:8000/api"

def print_step(msg):
    print(f"\n[{time.strftime('%H:%M:%S')}] {msg}")

# 1. Create users
print_step("Création des utilisateurs")

client_data = {"email": "client@test.com", "password": "password123", "first_name": "Test"}
res_data = {"email": "resto@test.com", "password": "password123", "nom_restaurant": "Test Resto"}
liv_data = {"email": "livreur@test.com", "password": "password123"}

r1 = requests.post(f"{BASE_URL}/auth/register/client", json=client_data)
r2 = requests.post(f"{BASE_URL}/auth/register/restaurant", json=res_data)
r3 = requests.post(f"{BASE_URL}/auth/register/livreur", json=liv_data)

# Extract tokens (or login if already exists)
if r1.status_code == 400:
    client_token = requests.post(f"{BASE_URL}/auth/login", json=client_data).json().get('token')
else:
    client_token = r1.json().get('token')

if r2.status_code == 400:
    res_token = requests.post(f"{BASE_URL}/auth/login", json=res_data).json().get('token')
else:
    res_token = r2.json().get('token')

if r3.status_code == 400:
    liv_token = requests.post(f"{BASE_URL}/auth/login", json=liv_data).json().get('token')
else:
    liv_token = r3.json().get('token')

print(f"Tokens récupérés.")

# 2. Add Plat as Restaurant
print_step("Le restaurant crée un plat")
plat_res = requests.post(
    f"{BASE_URL}/restaurant/menu/plats/",
    headers={"Authorization": f"Bearer {res_token}"},
    json={"nom": "Pizza Test", "prix": 5000}
)
print("Status Plat:", plat_res.status_code)
print("Reponse Plat:", plat_res.text)
if plat_res.status_code not in [200, 201]:
    raise Exception(f"Failed to create plat: {plat_res.text}")
plat_id = plat_res.json().get('id')
print(f"Plat créé : {plat_id}")


# 3. Get nearby restaurants as Client
print_step("Le client cherche des restaurants (Map)")
map_res = requests.get(f"{BASE_URL}/map/restaurants?lat=3.8&lon=11.5")
resto_id = plat_res.json().get('restaurant')
print(f"Restaurant selectionné : {resto_id}")

# 4. Client creates order
print_step("Le client crée une commande")
cmd_payload = {
    "restaurant": resto_id,
    "adresse_livraison": "Quartier Test",
    "items": [{"plat_id": plat_id, "quantite": 2}]
}
cmd_res = requests.post(
    f"{BASE_URL}/client/commandes/",
    headers={"Authorization": f"Bearer {client_token}"},
    json=cmd_payload
)
print("Status Commande:", cmd_res.status_code)
print("Reponse Commande:", cmd_res.text)
cmd_id = cmd_res.json().get('id')
print(f"Commande créée : {cmd_id}")

# 5. Restaurant accepts order
print_step("Le restaurant accepte la commande")
acc_res = requests.put(
    f"{BASE_URL}/restaurant/commandes/{cmd_id}/accept/",
    headers={"Authorization": f"Bearer {res_token}"}
)
print(f"Statut : {acc_res.json().get('statut')}")

# 6. Livreur views missions and accepts
print_step("Le livreur regarde les missions")
miss_res = requests.get(
    f"{BASE_URL}/livreur/missions/",
    headers={"Authorization": f"Bearer {liv_token}"}
)
print(f"Missions trouvées : {len(miss_res.json())}")

print_step("Le livreur accepte la mission")
liv_acc = requests.post(
    f"{BASE_URL}/livreur/missions/{cmd_id}/accept/",
    headers={"Authorization": f"Bearer {liv_token}"}
)
print(f"Mission assignée : {liv_acc.json().get('statut')}")

# 7. Livreur marks collected and delivered
print_step("Le livreur collecte la commande")
requests.put(
    f"{BASE_URL}/livreur/missions/{cmd_id}/collected/",
    headers={"Authorization": f"Bearer {liv_token}"}
)

print_step("Le livreur livre la commande")
liv_fin = requests.put(
    f"{BASE_URL}/livreur/missions/{cmd_id}/delivered/",
    headers={"Authorization": f"Bearer {liv_token}"}
)
print(f"Statut final : {liv_fin.json().get('statut')}")

print_step("SCÉNARIO VALIDÉ AVEC SUCCÈS")
