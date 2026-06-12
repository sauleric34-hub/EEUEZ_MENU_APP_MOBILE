import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000/api"

def print_res(res):
    print(f"Status: {res.status_code}")
    try:
        print(json.dumps(res.json(), indent=2, ensure_ascii=False))
    except:
        print(res.text)
    print("-" * 40)

def run():
    print("1. Fetch Map Restaurants...")
    res = requests.get(f"{BASE_URL}/map/restaurants?lat=3.8&lon=11.5")
    print_res(res)
    if res.status_code != 200 or not res.json():
        print("Failed to get restaurants")
        return

    restaurants = res.json()
    restaurant_id = restaurants[0]['id']

    print(f"2. Fetch Map Details for Restaurant {restaurant_id}...")
    res = requests.get(f"{BASE_URL}/map/restaurants/{restaurant_id}/details")
    print_res(res)
    details = res.json()
    if not details.get('platsPopulaires'):
        print("No popular plats found")
        return

    plat_id = details['platsPopulaires'][0]['id']

    print(f"3. Passer Commande (Frontend Cart Simulation) for Plat {plat_id}...")
    payload = {
        "restaurant": restaurant_id,
        "items": [
            {"plat_id": plat_id, "quantite": 2}
        ],
        "adresse_livraison": "Bastos, près du carrefour"
    }
    
    # Should work without Auth because of bypass
    res = requests.post(f"{BASE_URL}/client/commandes/", json=payload)
    print_res(res)
    if res.status_code != 201:
        print("Failed to place order!")
        return
        
    order = res.json()
    order_id = order['id']
    print(f"Order created! ID: {order_id}, Status: {order['statut']}")
    
    print("4. Fetch Order History (Suivi widget check)...")
    res = requests.get(f"{BASE_URL}/client/commandes/")
    print_res(res)
    
if __name__ == "__main__":
    run()
