"""Backend tests for TennisConnect new content APIs (articles/travel/recreation/tournaments + admin CRUD)."""
import os
import pytest
import requests

BASE_URL = "https://storage-connect-app-1.preview.emergentagent.com"

ADMIN_EMAIL = "admin@tennisconnect.com"
ADMIN_PASS = "admin123"
PLAYER_EMAIL = "shadowpn+7@gmail.com"
PLAYER_PASS = "newpassword123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
               timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def player_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": PLAYER_EMAIL, "password": PLAYER_PASS},
               timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Player login failed: {r.status_code}")
    return s


# ---------- Public list endpoints ----------
class TestPublicLists:
    def test_articles_list(self):
        r = requests.get(f"{BASE_URL}/api/articles", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6, f"Expected 6 articles, got {len(data)}"
        # Validate required keys
        for k in ("id", "slug", "title", "excerpt", "content"):
            assert k in data[0]

    def test_travel_list(self):
        r = requests.get(f"{BASE_URL}/api/travel", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 4

    def test_recreation_list(self):
        r = requests.get(f"{BASE_URL}/api/recreation", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 5

    def test_event_tournaments_list(self):
        r = requests.get(f"{BASE_URL}/api/event-tournaments", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6


# ---------- Public detail (by slug) ----------
class TestPublicDetail:
    def test_article_detail(self):
        list_r = requests.get(f"{BASE_URL}/api/articles", timeout=15).json()
        slug = list_r[0]["slug"]
        r = requests.get(f"{BASE_URL}/api/articles/{slug}", timeout=15)
        assert r.status_code == 200
        assert r.json()["slug"] == slug

    def test_travel_detail(self):
        slug = requests.get(f"{BASE_URL}/api/travel", timeout=15).json()[0]["slug"]
        r = requests.get(f"{BASE_URL}/api/travel/{slug}", timeout=15)
        assert r.status_code == 200
        assert r.json()["slug"] == slug

    def test_recreation_detail(self):
        slug = requests.get(f"{BASE_URL}/api/recreation", timeout=15).json()[0]["slug"]
        r = requests.get(f"{BASE_URL}/api/recreation/{slug}", timeout=15)
        assert r.status_code == 200
        assert r.json()["slug"] == slug

    def test_tournament_detail(self):
        slug = requests.get(f"{BASE_URL}/api/event-tournaments", timeout=15).json()[0]["slug"]
        r = requests.get(f"{BASE_URL}/api/event-tournaments/{slug}", timeout=15)
        assert r.status_code == 200
        assert r.json()["slug"] == slug

    def test_article_detail_404(self):
        r = requests.get(f"{BASE_URL}/api/articles/non-existent-slug-zzz", timeout=15)
        assert r.status_code == 404


# ---------- Admin status ----------
class TestAdminStatus:
    def test_admin_status_for_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/status", timeout=15)
        assert r.status_code == 200
        assert r.json().get("isAdmin") is True

    def test_admin_status_for_player(self, player_session):
        r = player_session.get(f"{BASE_URL}/api/admin/status", timeout=15)
        # Should be 200 with isAdmin=false OR 401/403
        if r.status_code == 200:
            assert r.json().get("isAdmin") is False
        else:
            assert r.status_code in (401, 403)

    def test_admin_status_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/status", timeout=15)
        # Either 401 or 200 with isAdmin=false
        if r.status_code == 200:
            assert r.json().get("isAdmin") is False
        else:
            assert r.status_code == 401


# ---------- Admin auth-gating ----------
class TestAdminAuthGate:
    def test_post_article_without_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/articles",
                          json={"title": "x", "excerpt": "x", "content": "x", "category": "tips"},
                          timeout=15)
        assert r.status_code == 401

    def test_post_article_as_player(self, player_session):
        r = player_session.post(f"{BASE_URL}/api/admin/articles",
                                json={"title": "x", "excerpt": "x", "content": "x", "category": "tips"},
                                timeout=15)
        assert r.status_code in (401, 403)


# ---------- Admin CRUD: Articles ----------
class TestAdminArticleCRUD:
    created_id = None

    def test_create_article(self, admin_session):
        payload = {
            "title": "TEST_Article For Pytest",
            "excerpt": "Test excerpt",
            "content": "Test content body",
            "category": "tips",
            "coverImage": "https://example.com/img.jpg",
            "author": "Test Author",
            "isPublished": True,
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/articles", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == payload["title"]
        assert "id" in data and "slug" in data
        TestAdminArticleCRUD.created_id = data["id"]
        TestAdminArticleCRUD.created_slug = data["slug"]

        # Verify GET returns it
        g = requests.get(f"{BASE_URL}/api/articles/{data['slug']}", timeout=15)
        assert g.status_code == 200
        assert g.json()["title"] == payload["title"]

    def test_update_article(self, admin_session):
        assert TestAdminArticleCRUD.created_id
        r = admin_session.put(
            f"{BASE_URL}/api/admin/articles/{TestAdminArticleCRUD.created_id}",
            json={"title": "TEST_Article Updated"},
            timeout=15)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Article Updated"

        # Confirm via GET
        slug = TestAdminArticleCRUD.created_slug
        g = requests.get(f"{BASE_URL}/api/articles/{slug}", timeout=15)
        assert g.json()["title"] == "TEST_Article Updated"

    def test_delete_article(self, admin_session):
        assert TestAdminArticleCRUD.created_id
        r = admin_session.delete(
            f"{BASE_URL}/api/admin/articles/{TestAdminArticleCRUD.created_id}",
            timeout=15)
        assert r.status_code == 200

        # Confirm 404
        slug = TestAdminArticleCRUD.created_slug
        g = requests.get(f"{BASE_URL}/api/articles/{slug}", timeout=15)
        assert g.status_code == 404


# ---------- Admin CRUD: Travel / Recreation / Tournaments (create+delete smoke) ----------
class TestOtherAdminCRUD:
    def test_travel_crud(self, admin_session):
        payload = {
            "title": "TEST_Travel Pkg",
            "destination": "Madrid",
            "description": "Test",
            "price": 1000,
            "duration": "5 days",
            "highlights": ["a", "b"],
            "includes": ["x"],
            "coverImage": "https://example.com/t.jpg",
            "isActive": True,
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/travel", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        upd = admin_session.put(f"{BASE_URL}/api/admin/travel/{tid}",
                                json={"title": "TEST_Travel Updated"}, timeout=15)
        assert upd.status_code == 200
        d = admin_session.delete(f"{BASE_URL}/api/admin/travel/{tid}", timeout=15)
        assert d.status_code == 200

    def test_recreation_crud(self, admin_session):
        payload = {
            "name": "TEST_Recreation",
            "type": "massage",
            "provider": "Test Provider",
            "location": "Test City",
            "description": "Test",
            "price": 50,
            "duration": "60 min",
            "benefits": ["relax"],
            "coverImage": "https://example.com/r.jpg",
            "isActive": True,
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/recreation", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        upd = admin_session.put(f"{BASE_URL}/api/admin/recreation/{rid}",
                                json={"name": "TEST_Recreation Updated"}, timeout=15)
        assert upd.status_code == 200
        d = admin_session.delete(f"{BASE_URL}/api/admin/recreation/{rid}", timeout=15)
        assert d.status_code == 200

    def test_event_tournament_crud(self, admin_session):
        payload = {
            "name": "TEST_Tournament",
            "location": "Test City",
            "startDate": "2026-06-15",
            "level": "ATP 250",
            "surface": "Hard",
            "price": 500,
            "organizer": "Test Org",
            "description": "Test event",
            "coverImage": "https://example.com/e.jpg",
            "isActive": True,
        }
        r = admin_session.post(f"{BASE_URL}/api/admin/event-tournaments", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        upd = admin_session.put(f"{BASE_URL}/api/admin/event-tournaments/{eid}",
                                json={"name": "TEST_Tournament Updated"}, timeout=15)
        assert upd.status_code == 200
        d = admin_session.delete(f"{BASE_URL}/api/admin/event-tournaments/{eid}", timeout=15)
        assert d.status_code == 200
