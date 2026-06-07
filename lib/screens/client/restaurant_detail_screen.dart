import '../../services/localization_service.dart';
import '../../services/shared_database_service.dart';
import 'checkout_screen.dart';

class RestaurantDetailScreen extends StatefulWidget {
  final String restaurantName;
  const RestaurantDetailScreen({super.key, required this.restaurantName});

  @override
  State<RestaurantDetailScreen> createState() => _RestaurantDetailScreenState();
}

class _RestaurantDetailScreenState extends State<RestaurantDetailScreen> {
  int cartCount = 0;
  int totalPrice = 0;

  void _addToCart(String dishName, int price) {
    setState(() {
      cartCount++;
      totalPrice += price;
    });
    SharedDatabaseService().addLog('CLIENT', 'Le client a ajouté "$dishName" ($price FCFA) à son panier');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              _buildSliverAppBar(),
              _buildSocialHeader(),
              _buildMenuCategories(),
              _buildMenuList(),
              const SliverToBoxAdapter(child: SizedBox(height: 120)),
            ],
          ),
          if (cartCount > 0) _buildCartBar(),
        ],
      ),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 280,
      pinned: true,
      stretch: true,
      backgroundColor: AppTheme.primary,
      iconTheme: const IconThemeData(color: Colors.white),
      flexibleSpace: FlexibleSpaceBar(
        centerTitle: false,
        titlePadding: const EdgeInsets.only(left: 20, bottom: 80),
        title: Text(
          widget.restaurantName,
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24, color: Colors.white, letterSpacing: -0.5),
        ),
        background: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(
              'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800',
              fit: BoxFit.cover,
            ),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: const [0.0, 0.4, 1.0],
                  colors: [Colors.black.withOpacity(0.2), Colors.black.withOpacity(0.1), Colors.black.withOpacity(0.9)],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSocialHeader() {
    return SliverToBoxAdapter(
      child: Transform.translate(
        offset: const Offset(0, -60),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: AppTheme.paddingLarge),
          padding: const EdgeInsets.all(AppTheme.paddingLarge),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 40, offset: const Offset(0, 20))],
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _socialStat(Icons.star_rounded, '4.8', '200+ Avis'),
                  _socialStat(Icons.delivery_dining_rounded, '25 min', 'Livraison'),
                  _socialStat(Icons.favorite_rounded, '1.2k', 'Likes'),
                ],
              ),
              const Divider(height: 40, thickness: 1),
              Row(
                children: [
                  const CircleAvatar(
                    radius: 18,
                    backgroundImage: NetworkImage('https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100'),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      '"Le meilleur Ndolé de Douala !"',
                      style: TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: AppTheme.primary),
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, color: AppTheme.textMuted),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _socialStat(IconData icon, String value, String label) {
    return Column(
      children: [
        Icon(icon, color: AppTheme.secondary, size: 24),
        const SizedBox(height: 6),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.primary, fontSize: 16)),
        Text(label, style: TextStyle(color: AppTheme.textMuted, fontSize: 10, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildMenuCategories() {
    return SliverToBoxAdapter(
      child: Container(
        height: 80,
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppTheme.paddingLarge),
          children: [
            _buildCategoryItem(t('popular'), true),
            _buildCategoryItem(t('tradition'), false),
            _buildCategoryItem(t('drinks'), false),
            _buildCategoryItem(t('sides'), false),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryItem(String title, bool isActive) {
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: FilterChip(
        label: Text(title),
        selected: isActive,
        onSelected: (bool value) {},
        backgroundColor: Colors.white,
        selectedColor: AppTheme.primary,
        labelStyle: TextStyle(
          color: isActive ? Colors.white : AppTheme.primary,
          fontWeight: FontWeight.bold,
          fontSize: 13,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15), side: BorderSide(color: AppTheme.primary.withOpacity(0.05))),
        showCheckmark: false,
      ),
    );
  }

  Widget _buildMenuList() {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.paddingLarge),
      sliver: SliverList(
        delegate: SliverChildListDelegate([
          _buildMenuItem('Poulet DG', 'Poulet frit, plantains, légumes.', 4500, 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=400'),
          _buildMenuItem('Ndole Viande', 'Feuilles de Ndole, arachides, boeuf.', 3500, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400'),
          _buildMenuItem('Bongo\'o Joby', 'Poisson frais sauce noire épicée.', 5000, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&q=80&w=400'),
        ]),
      ),
    );
  }

  Widget _buildMenuItem(String name, String desc, int price, String imageUrl) {
    return GestureDetector(
      onTap: () => _showDishDetail(name, desc, price, imageUrl),
      child: Container(
        margin: const EdgeInsets.only(bottom: 20),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20, offset: const Offset(0, 8))],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: AppTheme.primary)),
                  const SizedBox(height: 8),
                  Text(desc, style: const TextStyle(color: AppTheme.textMuted, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 16),
                  Text('$price ${t('currency')}', style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w900, fontSize: 15)),
                ],
              ),
            ),
            const SizedBox(width: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Image.network(imageUrl, width: 100, height: 100, fit: BoxFit.cover),
            ),
          ],
        ),
      ),
    );
  }

  void _showDishDetail(String name, String desc, int price, String imageUrl) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _DishDetailSheet(
        name: name,
        desc: desc,
        price: price,
        imageUrl: imageUrl,
        onAdd: (qty) {
          Navigator.pop(context);
          _addToCart('$qty x $name', price * qty);
        },
      ),
    );
  }

  Widget _buildCartBar() {
    return Positioned(
      bottom: 40,
      left: 24,
      right: 24,
      child: GestureDetector(
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (context) => CheckoutScreen(totalAmount: totalPrice))),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 22),
          decoration: BoxDecoration(
            color: AppTheme.primary,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [BoxShadow(color: AppTheme.primary.withOpacity(0.4), blurRadius: 40, offset: const Offset(0, 20))],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(10)),
                    child: Text('$cartCount', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
                  ),
                  const SizedBox(width: 16),
                  Text(t('view_cart').toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 1)),
                ],
              ),
              Text('$totalPrice ${t('currency')}', style: const TextStyle(color: AppTheme.secondary, fontWeight: FontWeight.w900, fontSize: 18)),
            ],
          ),
        ),
      ),
    );
  }
}

class _DishDetailSheet extends StatefulWidget {
  final String name;
  final String desc;
  final int price;
  final String imageUrl;
  final Function(int) onAdd;

  const _DishDetailSheet({required this.name, required this.desc, required this.price, required this.imageUrl, required this.onAdd});

  @override
  State<_DishDetailSheet> createState() => _DishDetailSheetState();
}

class _DishDetailSheetState extends State<_DishDetailSheet> {
  int qty = 1;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(40))),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(40)),
                child: Image.network(widget.imageUrl, height: 280, width: double.infinity, fit: BoxFit.cover),
              ),
              Positioned(
                top: 20,
                right: 20,
                child: GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
                    child: const Icon(Icons.close_rounded, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(widget.name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppTheme.primary)),
                    Text('${widget.price} ${t('currency')}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.accent)),
                  ],
                ),
                const SizedBox(height: 16),
                Text(widget.desc, style: TextStyle(color: AppTheme.textMuted, fontSize: 15, height: 1.5)),
                const SizedBox(height: 40),
                Row(
                  children: [
                    _qtyBtn(Icons.remove_rounded, () => setState(() => qty > 1 ? qty-- : null)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Text('$qty', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    ),
                    _qtyBtn(Icons.add_rounded, () => setState(() => qty++)),
                    const Spacer(),
                    SizedBox(
                      height: 60,
                      child: ElevatedButton(
                        onPressed: () => widget.onAdd(qty),
                        child: Text('${t('add_to_cart')} (${widget.price * qty} ${t('currency')})'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _qtyBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(border: Border.all(color: AppTheme.primary.withOpacity(0.1)), borderRadius: BorderRadius.circular(15)),
        child: Icon(icon, color: AppTheme.primary, size: 20),
      ),
    );
  }
}
