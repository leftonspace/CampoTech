from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="campotech",
    version="1.0.0",
    author="CampoTech",
    author_email="api@campotech.com",
    description="Official Python SDK for the CampoTech API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/campotech/sdk-python",
    project_urls={
        "Documentation": "https://developers.campotech.com",
        "Bug Tracker": "https://github.com/campotech/sdk-python/issues",
    },
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.25.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
            "types-requests>=2.28.0",
        ],
    },
)
