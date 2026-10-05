"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // 1. Make a POST request to http://localhost:8080/api/auth/login
            // 2. Send the email and password in the body
            // 3. Make sure to set: credentials: "include"
            // 4. Also set the Content-Type header to "application/json"

            const response = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                credentials: "include",
                headers: {
                    'Content-Type': "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            })

            if (response.ok) {
                router.push("/"); // Redirect to the Drive page
            } else {
                alert("Login failed");
            }

        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-100">
            <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md w-96">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Dropbox Login</h2>

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 mb-4 border rounded text-gray-900"
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 mb-6 border rounded text-gray-900"
                    required
                />

                <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
                    Log In
                </button>
            </form>
        </div>
    );
}
