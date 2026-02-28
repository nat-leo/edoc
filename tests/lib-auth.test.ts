import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/firebase";

// --- mock "@/lib/firebase" first (must come before importing the module under test) ---
vi.mock("@/lib/firebase", () => {
  return {
    auth: {
      signOut: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// --- mock firebase/auth functions used by your wrapper ---
const onAuthStateChangedMock = vi.fn(() => "unsub-auth");
const onIdTokenChangedMock = vi.fn(() => "unsub-token");

const setPersistenceMock = vi.fn().mockResolvedValue(undefined);
const signInWithEmailAndPasswordMock = vi.fn().mockResolvedValue("signed-in");
const createUserWithEmailAndPasswordMock = vi.fn().mockResolvedValue("signed-up");
const signInWithPopupMock = vi.fn().mockResolvedValue("popup-ok");

const GoogleAuthProviderMock = vi.fn(function GoogleAuthProvider(this: any) {
  // constructor can be empty; wrapper just instantiates it
});

const browserLocalPersistenceMock = { kind: "local" };
const browserSessionPersistenceMock = { kind: "session" };

vi.mock("firebase/auth", () => {
  return {
    GoogleAuthProvider: GoogleAuthProviderMock,
    signInWithPopup: signInWithPopupMock,
    createUserWithEmailAndPassword: createUserWithEmailAndPasswordMock,
    signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
    setPersistence: setPersistenceMock,
    browserLocalPersistence: browserLocalPersistenceMock,
    browserSessionPersistence: browserSessionPersistenceMock,
    onAuthStateChanged: onAuthStateChangedMock,
    onIdTokenChanged: onIdTokenChangedMock,
  };
});

describe("lib/firebase/auth wrappers", async () => {
  // import AFTER mocks are set up
  const mod = await import("@/lib//auth"); // adjust path if needed

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("onAuthStateChanged passes auth + cb through and returns unsubscribe", () => {
    const cb = vi.fn();
    const unsub = mod.onAuthStateChanged(cb);

    expect(onAuthStateChangedMock).toHaveBeenCalledTimes(1);
    // first arg is auth instance from "@/lib/firebase"
    expect(onAuthStateChangedMock).toHaveBeenCalledWith(auth, cb);
    expect(unsub).toBe("unsub-auth");
  });


    it("onIdTokenChanged passes auth + cb through and returns unsubscribe", () => {
    const cb = vi.fn();
    const unsub = mod.onIdTokenChanged(cb);

    expect(onIdTokenChangedMock).toHaveBeenCalledTimes(1);
    expect(onIdTokenChangedMock).toHaveBeenCalledWith(auth, cb);
    expect(unsub).toBe("unsub-token");
    });

  it("signInWithGoogle creates a provider and calls signInWithPopup(auth, provider)", async () => {
    await mod.signInWithGoogle();

    expect(GoogleAuthProviderMock).toHaveBeenCalledTimes(1);
    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
    // second arg should be the provider instance created by new GoogleAuthProvider()
    const providerInstance = (signInWithPopupMock.mock.calls[0] as any[])[1];
    expect(providerInstance).toBeInstanceOf((GoogleAuthProviderMock as any));
  });

  it("signOut calls auth.signOut()", async () => {
    const { auth } = await import("@/lib/firebase");
    await mod.signOut();

    expect((auth as any).signOut).toHaveBeenCalledTimes(1);
  });

  it("signInWithEmailPassword sets local persistence when remember=true then signs in", async () => {
    await mod.signInWithEmailPassword({
      email: "a@b.com",
      password: "pw",
      remember: true,
    });

    expect(setPersistenceMock).toHaveBeenCalledTimes(1);
    expect(setPersistenceMock.mock.calls[0][1]).toBe(browserLocalPersistenceMock);

    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledTimes(1);
    expect(signInWithEmailAndPasswordMock.mock.calls[0].slice(1)).toEqual(["a@b.com", "pw"]);
  });

  it("signInWithEmailPassword sets session persistence when remember=false then signs in", async () => {
    await mod.signInWithEmailPassword({
      email: "a@b.com",
      password: "pw",
      remember: false,
    });

    expect(setPersistenceMock).toHaveBeenCalledTimes(1);
    expect(setPersistenceMock.mock.calls[0][1]).toBe(browserSessionPersistenceMock);

    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledTimes(1);
  });

  it("signUpWithEmailPassword calls createUserWithEmailAndPassword(auth, email, password)", async () => {
    await mod.signUpWithEmailPassword({ email: "x@y.com", password: "pw2" });

    expect(createUserWithEmailAndPasswordMock).toHaveBeenCalledTimes(1);
    expect(createUserWithEmailAndPasswordMock.mock.calls[0].slice(1)).toEqual(["x@y.com", "pw2"]);
  });
});